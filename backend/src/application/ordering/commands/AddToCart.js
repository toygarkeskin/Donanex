"use strict";

const { Command } = require("../../shared/cqrs/Message");
const { NotFoundError, ConflictError } = require("../../../domain/shared/errors");
const { requireUuid, requireQuantity } = require("../../../domain/shared/guards");
const { Cart, MAX_QUANTITY_PER_ITEM } = require("../../../domain/ordering/Cart");
const { resolveCart } = require("../services/resolveCart");

class AddToCartCommand extends Command {
  constructor(input) {
    super();
    this.userId = input?.userId ?? null;
    this.guestCartId = input?.guestCartId ?? null;
    this.productId = input?.productId;
    this.quantity = input?.quantity ?? 1;
  }
}

/**
 * Sepete ürün ekler. Kayıt ZORUNLU DEĞİLDİR: misafir de sepet oluşturabilir.
 * Ürünün satışta ve stokta olduğu sunucuda doğrulanır.
 */
class AddToCartHandler {
  constructor({ unitOfWork }) {
    this.unitOfWork = unitOfWork;
  }

  async handle({ userId, guestCartId, productId, quantity }) {
    requireUuid(productId, "Ürün numarası");
    const amount = requireQuantity(quantity, "Adet", MAX_QUANTITY_PER_ITEM);

    return this.unitOfWork.run(async (repos) => {
      const product = await repos.products.findPurchasable(productId);
      if (!product) throw new NotFoundError("Ürün bulunamadı veya satışta değil.");

      const cart = await resolveCart(repos, { userId, guestCartId });
      const lines = await repos.carts.listLines(cart.id);
      const total = Cart.assertCanAdd(lines, productId, amount);

      if (product.stock < total) {
        throw new ConflictError(`Bu üründen en fazla ${product.stock} adet alabilirsiniz.`);
      }

      await repos.carts.setLine(cart.id, productId, total);
      return { cartId: cart.id, isGuestCart: !userId };
    });
  }
}

module.exports = { AddToCartCommand, AddToCartHandler };
