"use strict";

import { ConflictError, ValidationError } from "../shared/errors";
import { Money, type MoneyView } from "../shared/Money";
import { requireQuantity } from "../shared/guards";

export const MAX_DISTINCT_ITEMS = 50;
export const MAX_QUANTITY_PER_ITEM = 99;

/** Sepet satırı: yalnızca ürün ve adet. Fiyat BİLEREK tutulmaz. */
export interface CartLine {
  productId: string;
  quantity: number;
}

/** Sepeti görüntülerken okunan güncel ürün bilgisi. */
export interface CartProduct {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly price: Money;
  readonly stock: number;
  readonly status: string;
  readonly storeId: string;
  readonly storeName: string;
  readonly storeSlug: string;
  readonly imageUrl: string;
}

/** Satırın neden kullanılamadığı. */
export type CartIssue = "removed" | "unavailable" | "insufficient_stock" | null;

export interface CartItemView {
  readonly productId: string;
  readonly name?: string;
  readonly slug?: string;
  readonly imageUrl?: string;
  readonly storeId?: string;
  readonly storeName?: string;
  readonly storeSlug?: string;
  readonly unitPrice?: MoneyView;
  readonly quantity: number;
  readonly lineTotal?: MoneyView;
  readonly stock?: number;
  readonly available: boolean;
  readonly issue: CartIssue;
}

export interface CartView {
  readonly items: readonly CartItemView[];
  readonly itemCount: number;
  readonly subtotal: MoneyView;
  readonly hasIssues: boolean;
  readonly canCheckout: boolean;
}

/**
 * Sepet hesaplamaları. Sepet satırlarında yalnızca ürün ve adet tutulur;
 * fiyat her görüntülemede güncel üründen okunur, böylece istemci fiyat
 * belirleyemez ve eski fiyat sepette donup kalmaz.
 *
 * Misafir sepeti de giriş yapmış kullanıcının sepeti de aynı kuralları kullanır.
 */
export class Cart {
  readonly lines: readonly CartLine[];
  readonly products: ReadonlyMap<string, CartProduct>;

  constructor(lines: readonly CartLine[], products: ReadonlyMap<string, CartProduct>) {
    this.lines = lines;
    this.products = products;
    Object.freeze(this);
  }

  static assertCanAdd(lines: readonly CartLine[], productId: string, quantity: unknown): number {
    const adet = requireQuantity(quantity, "Adet", MAX_QUANTITY_PER_ITEM);
    const existing = lines.find((line) => line.productId === productId);
    if (!existing && lines.length >= MAX_DISTINCT_ITEMS) {
      throw new ConflictError(`Sepete en fazla ${MAX_DISTINCT_ITEMS} farklı ürün ekleyebilirsiniz.`);
    }
    const total = (existing?.quantity || 0) + adet;
    if (total > MAX_QUANTITY_PER_ITEM) {
      throw new ConflictError(`Bir üründen en fazla ${MAX_QUANTITY_PER_ITEM} adet alabilirsiniz.`);
    }
    return total;
  }

  /**
   * İki sepeti birleştirir. Misafirken sepete ürün ekleyip sonra giriş yapan
   * kullanıcı hiçbir ürününü kaybetmez; aynı ürün iki sepette de varsa
   * adetler toplanır (üst sınırı aşmadan).
   */
  static merge(targetLines: readonly CartLine[], sourceLines: readonly CartLine[]): CartLine[] {
    const merged: CartLine[] = targetLines.map((line) => ({ ...line }));
    for (const line of sourceLines) {
      const existing = merged.find((item) => item.productId === line.productId);
      if (existing) {
        existing.quantity = Math.min(MAX_QUANTITY_PER_ITEM, existing.quantity + line.quantity);
      } else if (merged.length < MAX_DISTINCT_ITEMS) {
        merged.push({ ...line });
      }
    }
    return merged;
  }

  /** Vitrin görünümü: her satırın güncel fiyatı, stok durumu ve uyarısı. */
  toView(): CartView {
    const items: CartItemView[] = this.lines.map((line) => {
      const product = this.products.get(line.productId);
      if (!product) {
        return { productId: line.productId, quantity: line.quantity, available: false, issue: "removed" };
      }
      const purchasable = product.status === "active";
      const inStock = product.stock >= line.quantity;
      return {
        productId: product.id,
        name: product.name,
        slug: product.slug,
        imageUrl: product.imageUrl,
        storeId: product.storeId,
        storeName: product.storeName,
        storeSlug: product.storeSlug,
        unitPrice: product.price.toJSON(),
        quantity: line.quantity,
        lineTotal: product.price.multiply(line.quantity).toJSON(),
        stock: product.stock,
        available: purchasable && inStock,
        issue: !purchasable ? "unavailable" : !inStock ? "insufficient_stock" : null
      };
    });

    const usable = items.filter((item) => item.available);
    const subtotal = Money.sum(usable.map((item) => Money.fromCents(item.lineTotal!.cents)));

    return {
      items,
      itemCount: items.reduce((total, item) => total + item.quantity, 0),
      subtotal: subtotal.toJSON(),
      hasIssues: items.some((item) => !item.available),
      canCheckout: usable.length > 0 && items.every((item) => item.available)
    };
  }

  /** Siparişe çevrilebilir mi? Sorunlu satır varsa sipariş açılmaz. */
  assertCheckoutReady(): CartView {
    const view = this.toView();
    if (!view.items.length) throw new ValidationError("Sepetiniz boş.");
    if (!view.canCheckout) {
      throw new ConflictError("Sepetinizde satışta olmayan veya stoğu yetmeyen ürünler var.");
    }
    return view;
  }
}
