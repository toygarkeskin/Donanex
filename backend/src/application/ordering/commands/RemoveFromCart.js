"use strict";

const { Command } = require("../../shared/cqrs/Message");
const { NotFoundError } = require("../../../domain/shared/errors");
const { requireUuid } = require("../../../domain/shared/guards");
const { resolveCart } = require("../services/resolveCart");

class RemoveFromCartCommand extends Command {
  constructor(input) {
    super();
    this.userId = input?.userId ?? null;
    this.guestCartId = input?.guestCartId ?? null;
    this.productId = input?.productId;
  }
}

class RemoveFromCartHandler {
  constructor({ unitOfWork }) {
    this.unitOfWork = unitOfWork;
  }

  async handle({ userId, guestCartId, productId }) {
    requireUuid(productId, "Ürün numarası");

    return this.unitOfWork.run(async (repos) => {
      const cart = await resolveCart(repos, { userId, guestCartId, create: false });
      if (!cart) throw new NotFoundError("Sepet bulunamadı.");
      await repos.carts.removeLine(cart.id, productId);
      return { cartId: cart.id };
    });
  }
}

module.exports = { RemoveFromCartCommand, RemoveFromCartHandler };
