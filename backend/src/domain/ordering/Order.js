"use strict";

const { ValidationError, ConflictError } = require("../shared/errors");
const { isNonEmptyString, isEmail, isPhone, isId } = require("../shared/guards");
const { toCents, centsToDecimalString } = require("../shared/money");
const { OrderStatus } = require("./OrderStatus");

const MAX_LINES = 100;
const MAX_QUANTITY = 99;

/** Sipariş oluşturma kuralları (saf iş mantığı, veritabanı bilmez). */
class Order {
  /** Alıcı bilgisini ve sepet satırlarını doğrular; aynı ürünün satırlarını birleştirir. */
  static validateCheckout(input) {
    const { fullName, email, phone, address, items } = input || {};

    const valid =
      isNonEmptyString(fullName, 150) &&
      isEmail(email) &&
      isPhone(phone) &&
      isNonEmptyString(address, 1000) &&
      Array.isArray(items) &&
      items.length > 0 &&
      items.length <= MAX_LINES &&
      items.every(
        (item) =>
          item &&
          isId(item.productId) &&
          Number.isInteger(item.quantity) &&
          item.quantity >= 1 &&
          item.quantity <= MAX_QUANTITY
      );

    if (!valid) {
      throw new ValidationError("Lütfen alıcı bilgilerini ve sepetinizi kontrol edin.");
    }

    const quantities = new Map();
    for (const item of items) {
      const id = Number(item.productId);
      quantities.set(id, (quantities.get(id) || 0) + item.quantity);
    }

    return {
      recipient: {
        name: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        address: address.trim()
      },
      items: [...quantities].map(([productId, quantity]) => ({ productId, quantity }))
    };
  }

  /**
   * Miktar, stok ve toplamı sunucuda hesaplar (istemci fiyatına güvenilmez).
   *
   * @param {Array<{productId:number,quantity:number}>} items
   * @param {Array<{id:number,name:string,price:string|number,stock:number}>} products
   */
  static place({ customerId, recipient, items, products }) {
    const byId = new Map(products.map((p) => [Number(p.id), p]));

    let totalCents = 0;
    const lines = items.map(({ productId, quantity }) => {
      const product = byId.get(productId);
      if (!product) {
        throw new ValidationError("Sepetinizde satışta olmayan bir ürün var.");
      }
      if (Number(product.stock) < quantity) {
        throw new ConflictError(
          `"${product.name}" ürününden yeterli stok yok. Mevcut stok: ${product.stock}`
        );
      }
      const unitCents = toCents(product.price);
      if (unitCents === null) throw new Error("Ürün fiyatı geçersiz.");

      totalCents += unitCents * quantity;
      return {
        productId: product.id,
        productName: product.name,
        quantity,
        unitPrice: centsToDecimalString(unitCents)
      };
    });

    if (!Number.isSafeInteger(totalCents) || totalCents > 999_999_999_999) {
      throw new ValidationError("Sipariş tutarı izin verilen sınırı aşıyor.");
    }

    return {
      customerId: customerId || null,
      recipient,
      lines,
      total: centsToDecimalString(totalCents),
      status: OrderStatus.AWAITING_PAYMENT
    };
  }
}

module.exports = { Order, MAX_QUANTITY };
