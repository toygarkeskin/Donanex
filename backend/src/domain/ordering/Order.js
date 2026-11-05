"use strict";

const { ValidationError, ConflictError } = require("../shared/errors");
const { Money } = require("../shared/Money");
const { requireText, requireEmail, isPhone } = require("../shared/guards");
const { OrderStatus, PackageStatus } = require("./OrderStatus");

/**
 * Sipariş oluşturma kuralları. Tutar ve stok kontrolü tamamen sunucuda yapılır;
 * istemciden gelen fiyat hiçbir aşamada kullanılmaz.
 *
 * Kayıtsız (misafir) kullanıcı da sipariş verebilir: userId null olur,
 * iletişim bilgisi siparişin üzerinde taşınır.
 */
class Order {
  /** Teslimat ve iletişim bilgisini doğrular. */
  static validateCheckout(input) {
    const data = input || {};
    const contact = data.contact || {};
    const address = data.shippingAddress || {};

    if (!isPhone(contact.phone)) throw new ValidationError("Telefon numarası geçersiz.");

    return Object.freeze({
      contact: Object.freeze({
        email: requireEmail(contact.email),
        fullName: requireText(contact.fullName, "Ad Soyad", 150),
        phone: String(contact.phone).trim()
      }),
      shippingAddress: Object.freeze({
        fullName: requireText(address.fullName, "Teslim alacak kişi", 150),
        phone: isPhone(address.phone) ? String(address.phone).trim() : String(contact.phone).trim(),
        city: requireText(address.city, "İl", 80),
        district: requireText(address.district, "İlçe", 80),
        line: requireText(address.line, "Açık adres", 500),
        postalCode: address.postalCode ? requireText(address.postalCode, "Posta kodu", 20) : null
      }),
      note: data.note ? requireText(data.note, "Sipariş notu", 500) : null
    });
  }

  /**
   * Sepeti mağazalara göre paketlere böler ve tutarları hesaplar.
   *
   * @param {object} checkout  validateCheckout sonucu
   * @param {Array}  lines     [{productId, quantity}]
   * @param {Map}    products  veritabanından KİLİTLENEREK okunmuş güncel ürünler
   */
  static place({ userId = null, checkout, lines, products }) {
    if (!lines.length) throw new ValidationError("Sepetiniz boş.");

    const byStore = new Map();

    for (const line of lines) {
      const product = products.get(line.productId);
      if (!product || product.status !== "active") {
        throw new ConflictError("Sepetinizde satışta olmayan bir ürün var.");
      }
      if (product.storeStatus !== "active") {
        throw new ConflictError(`"${product.storeName}" mağazası şu anda satış yapmıyor.`);
      }
      if (product.stock < line.quantity) {
        throw new ConflictError(
          `"${product.name}" ürününden yeterli stok yok. Kalan: ${product.stock} adet`
        );
      }

      const unitPrice = Money.fromCents(product.priceCents);
      const item = {
        productId: product.id,
        productName: product.name,
        productImageUrl: product.imageUrl,
        unitPrice,
        quantity: line.quantity,
        lineTotal: unitPrice.multiply(line.quantity)
      };

      if (!byStore.has(product.storeId)) {
        byStore.set(product.storeId, { storeId: product.storeId, storeName: product.storeName, items: [] });
      }
      byStore.get(product.storeId).items.push(item);
    }

    const packages = [...byStore.values()].map((pkg) => ({
      ...pkg,
      subtotal: Money.sum(pkg.items.map((item) => item.lineTotal)),
      status: PackageStatus.PENDING
    }));

    const total = Money.sum(packages.map((pkg) => pkg.subtotal));
    if (total.isZero()) throw new ValidationError("Sipariş tutarı sıfır olamaz.");

    return Object.freeze({
      userId,
      contact: checkout.contact,
      shippingAddress: checkout.shippingAddress,
      note: checkout.note,
      packages,
      total,
      status: OrderStatus.PENDING_PAYMENT
    });
  }
}

module.exports = { Order };
