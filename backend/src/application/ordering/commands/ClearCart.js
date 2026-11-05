"use strict";

const { Command } = require("../../shared/cqrs/Message");
const { resolveCart } = require("../services/resolveCart");

class ClearCartCommand extends Command {
  constructor(input) {
    super();
    this.userId = input?.userId ?? null;
    this.guestCartId = input?.guestCartId ?? null;
  }
}

class ClearCartHandler {
  constructor({ unitOfWork }) {
    this.unitOfWork = unitOfWork;
  }

  async handle({ userId, guestCartId }) {
    return this.unitOfWork.run(async (repos) => {
      const cart = await resolveCart(repos, { userId, guestCartId, create: false });
      if (cart) await repos.carts.replaceLines(cart.id, []);
      return { cleared: Boolean(cart) };
    });
  }
}

module.exports = { ClearCartCommand, ClearCartHandler };
