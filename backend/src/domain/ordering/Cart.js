"use strict";

const { ConflictError, ValidationError } = require("../shared/errors");
const { Money } = require("../shared/Money");
const { requireQuantity } = require("../shared/guards");

const MAX_DISTINCT_ITEMS = 50;
const MAX_QUANTITY_PER_ITEM = 99;

/**
 * Sepet hesaplamaları. Sepet satırlarında yalnızca ürün ve adet tutulur;
 * fiyat her görüntülemede güncel üründen okunur, böylece istemci fiyat
 * belirleyemez ve eski fiyat sepette donup kalmaz.
 *
 * Misafir sepeti de giriş yapmış kullanıcının sepeti de aynı kuralları kullanır.
 */
class Cart {
  /**
   * @param {Array<{productId:string, quantity:number}>} lines
   * @param {Map<string, {id,name,price:Money,stock,status,storeId,storeName,imageUrl}>} products
   */
  constructor(lines, products) {
    this.lines = lines;
    this.products = products;
    Object.freeze(this);
  }

  static assertCanAdd(lines, productId, quantity) {
    requireQuantity(quantity, "Adet", MAX_QUANTITY_PER_ITEM);
    const existing = lines.find((line) => line.productId === productId);
    if (!existing && lines.length >= MAX_DISTINCT_ITEMS) {
      throw new ConflictError(`Sepete en fazla ${MAX_DISTINCT_ITEMS} farklı ürün ekleyebilirsiniz.`);
    }
    const total = (existing?.quantity || 0) + quantity;
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
  static merge(targetLines, sourceLines) {
    const merged = targetLines.map((line) => ({ ...line }));
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
  toView() {
    const items = this.lines.map((line) => {
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
    const subtotal = Money.sum(usable.map((item) => Money.fromCents(item.lineTotal.cents)));

    return {
      items,
      itemCount: items.reduce((total, item) => total + item.quantity, 0),
      subtotal: subtotal.toJSON(),
      hasIssues: items.some((item) => !item.available),
      canCheckout: usable.length > 0 && items.every((item) => item.available)
    };
  }

  /** Siparişe çevrilebilir mi? Sorunlu satır varsa sipariş açılmaz. */
  assertCheckoutReady() {
    const view = this.toView();
    if (!view.items.length) throw new ValidationError("Sepetiniz boş.");
    if (!view.canCheckout) {
      throw new ConflictError("Sepetinizde satışta olmayan veya stoğu yetmeyen ürünler var.");
    }
    return view;
  }
}

module.exports = { Cart, MAX_DISTINCT_ITEMS, MAX_QUANTITY_PER_ITEM };
