"use strict";

const { Query } = require("../../shared/cqrs/Message");
const { Money } = require("../../../domain/shared/Money");
const { Cart } = require("../../../domain/ordering/Cart");

class GetCartQuery extends Query {
  constructor(input) {
    super();
    this.userId = input?.userId ?? null;
    this.guestCartId = input?.guestCartId ?? null;
  }
}

/**
 * Sepeti güncel fiyat ve stok bilgisiyle döndürür.
 * Satışta olmayan ya da stoğu yetmeyen satırlar uyarıyla işaretlenir;
 * kullanıcı sepete bakarken sorunu görür ve ödeme adımında sürprizle karşılaşmaz.
 */
class GetCartHandler {
  constructor({ cartReadModel }) {
    this.readModel = cartReadModel;
  }

  async handle({ userId, guestCartId }) {
    const empty = { items: [], itemCount: 0, subtotal: Money.zero().toJSON(), hasIssues: false, canCheckout: false };

    const cartId = await this.readModel.findCartId({ userId, guestCartId });
    if (!cartId) return empty;

    const { lines, products } = await this.readModel.getLines(cartId);
    if (!lines.length) return empty;

    const view = new Cart(
      lines,
      new Map(products.map((product) => [product.id, { ...product, price: Money.fromCents(product.priceCents) }]))
    ).toView();

    return { ...view, cartId };
  }
}

module.exports = { GetCartQuery, GetCartHandler };
