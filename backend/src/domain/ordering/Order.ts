"use strict";

import { ValidationError, ConflictError } from "../shared/errors";
import { Money } from "../shared/Money";
import { requireText, requireEmail, isPhone } from "../shared/guards";
import { OrderStatus, PackageStatus, type OrderStatusKind, type PackageStatusKind } from "./OrderStatus";
import type { CartLine } from "./Cart";

export interface Contact {
  readonly email: string;
  readonly fullName: string;
  readonly phone: string;
}

export interface ShippingAddress {
  readonly fullName: string;
  readonly phone: string;
  readonly city: string;
  readonly district: string;
  readonly line: string;
  readonly postalCode: string | null;
}

export interface Checkout {
  readonly contact: Contact;
  readonly shippingAddress: ShippingAddress;
  readonly note: string | null;
}

/** Sipariş anında KİLİTLENEREK okunan ürün satırı. */
export interface LockedProduct {
  readonly id: string;
  readonly name: string;
  readonly imageUrl: string;
  readonly priceCents: number;
  readonly stock: number;
  readonly status: string;
  readonly storeId: string;
  readonly storeName: string;
  readonly storeStatus: string;
}

export interface OrderItem {
  readonly productId: string;
  readonly productName: string;
  readonly productImageUrl: string;
  readonly unitPrice: Money;
  readonly quantity: number;
  readonly lineTotal: Money;
}

export interface OrderPackage {
  readonly storeId: string;
  readonly storeName: string;
  readonly items: readonly OrderItem[];
  readonly subtotal: Money;
  readonly status: PackageStatusKind;
}

export interface PlacedOrder {
  readonly userId: string | null;
  readonly contact: Contact;
  readonly shippingAddress: ShippingAddress;
  readonly note: string | null;
  readonly packages: readonly OrderPackage[];
  readonly total: Money;
  readonly status: OrderStatusKind;
}

/**
 * Sipariş oluşturma kuralları. Tutar ve stok kontrolü tamamen sunucuda yapılır;
 * istemciden gelen fiyat hiçbir aşamada kullanılmaz.
 *
 * Kayıtsız (misafir) kullanıcı da sipariş verebilir: userId null olur,
 * iletişim bilgisi siparişin üzerinde taşınır.
 */
export class Order {
  /** Teslimat ve iletişim bilgisini doğrular. */
  static validateCheckout(input?: Record<string, any> | null): Checkout {
    const data = input ?? {};
    const contact = data.contact ?? {};
    const address = data.shippingAddress ?? {};

    if (!isPhone(contact.phone)) throw new ValidationError("Telefon numarası geçersiz.");
    const iletisimTelefon = contact.phone.trim();

    return Object.freeze({
      contact: Object.freeze({
        email: requireEmail(contact.email),
        fullName: requireText(contact.fullName, "Ad Soyad", 150),
        phone: iletisimTelefon
      }),
      shippingAddress: Object.freeze({
        fullName: requireText(address.fullName, "Teslim alacak kişi", 150),
        phone: isPhone(address.phone) ? address.phone.trim() : iletisimTelefon,
        city: requireText(address.city, "İl", 80),
        district: requireText(address.district, "İlçe", 80),
        line: requireText(address.line, "Açık adres", 500),
        postalCode: address.postalCode ? requireText(address.postalCode, "Posta kodu", 20) : null
      }),
      note: data.note ? requireText(data.note, "Sipariş notu", 500) : null
    });
  }

  /** Sepeti mağazalara göre paketlere böler ve tutarları hesaplar. */
  static place({
    userId = null,
    checkout,
    lines,
    products
  }: {
    userId?: string | null;
    checkout: Checkout;
    lines: readonly CartLine[];
    products: ReadonlyMap<string, LockedProduct>;
  }): PlacedOrder {
    if (!lines.length) throw new ValidationError("Sepetiniz boş.");

    const byStore = new Map<string, { storeId: string; storeName: string; items: OrderItem[] }>();

    for (const line of lines) {
      const product = products.get(line.productId);
      if (!product || product.status !== "active") {
        throw new ConflictError("Sepetinizde satışta olmayan bir ürün var.");
      }
      if (product.storeStatus !== "active") {
        throw new ConflictError(`"${product.storeName}" mağazası şu anda satış yapmıyor.`);
      }
      if (product.stock < line.quantity) {
        throw new ConflictError(`"${product.name}" ürününden yeterli stok yok. Kalan: ${product.stock} adet`);
      }

      const unitPrice = Money.fromCents(product.priceCents);
      const item: OrderItem = {
        productId: product.id,
        productName: product.name,
        productImageUrl: product.imageUrl,
        unitPrice,
        quantity: line.quantity,
        lineTotal: unitPrice.multiply(line.quantity)
      };

      let paket = byStore.get(product.storeId);
      if (!paket) {
        paket = { storeId: product.storeId, storeName: product.storeName, items: [] };
        byStore.set(product.storeId, paket);
      }
      paket.items.push(item);
    }

    const packages: OrderPackage[] = [...byStore.values()].map((pkg) => ({
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
