"use strict";

const { Command } = require("../../shared/cqrs/Message");
const { NotFoundError, ConflictError } = require("../../../domain/shared/errors");
const { requireUuid, requireQuantity } = require("../../../domain/shared/guards");
const { MAX_QUANTITY_PER_ITEM } = require("../../../domain/ordering/Cart");
const { resolveCart } = require("../services/resolveCart");

class UpdateCartItemCommand extends Command {
  constructor(input) {
    super();
    this.userId = input?.userId ?? null;
    this.guestCartId = input?.guestCartId ?? null;
    this.productId = input?.productId;
    this.quantity = input?.quantity;
  }
}

class UpdateCartItemHandler {
  constructor({ unitOfWork }) {
    this.unitOfWork = unitOfWork;
  }

  async handle({ userId, guestCartId, productId, quantity }) {
    requireUuid(productId, "Ürün numarası");
    const amount = requireQuantity(quantity, "Adet", MAX_QUANTITY_PER_ITEM);

    return this.unitOfWork.run(async (repos) => {
      const cart = await resolveCart(repos, { userId, guestCartId, create: false });
      if (!cart) throw new NotFoundError("Sepet bulunamadı.");

      const product = await repos.products.findPurchasable(productId);
      if (!product) throw new NotFoundError("Ürün bulunamadı veya satışta değil.");
      if (product.stock < amount) {
        throw new ConflictError(`Bu üründen en fazla ${product.stock} adet alabilirsiniz.`);
      }

      const updated = await repos.carts.setLine(cart.id, productId, amount);
      if (!updated) throw new NotFoundError("Ürün sepetinizde bulunamadı.");
      return { cartId: cart.id };
    });
  }
}

module.exports = { UpdateCartItemCommand, UpdateCartItemHandler };
