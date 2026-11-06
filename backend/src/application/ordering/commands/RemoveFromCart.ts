"use strict";

import { Command, type Handler } from "../../shared/cqrs/Message";
import { NotFoundError } from "../../../domain/shared/errors";
import { requireUuid } from "../../../domain/shared/guards";
import { resolveCart } from "../services/resolveCart";
import type { UnitOfWork } from "../../shared/contracts";

export class RemoveFromCartCommand extends Command {
  readonly userId: string | null;
  readonly guestCartId: string | null;
  readonly productId: string;

  constructor(input?: { userId?: string | null; guestCartId?: string | null; productId?: string }) {
    super();
    this.userId = input?.userId ?? null;
    this.guestCartId = input?.guestCartId ?? null;
    this.productId = input?.productId as string;
  }
}

export interface CartUpdated {
  readonly cartId: string;
}

export class RemoveFromCartHandler implements Handler<RemoveFromCartCommand, CartUpdated> {
  private readonly unitOfWork: UnitOfWork;

  constructor({ unitOfWork }: { unitOfWork: UnitOfWork }) {
    this.unitOfWork = unitOfWork;
  }

  async handle({ userId, guestCartId, productId }: RemoveFromCartCommand): Promise<CartUpdated> {
    requireUuid(productId, "Ürün numarası");

    return this.unitOfWork.run(async (repos) => {
      const cart = await resolveCart(repos, { userId, guestCartId, create: false });
      if (!cart) throw new NotFoundError("Sepet bulunamadı.");
      await repos.carts.removeLine(cart.id, productId);
      return { cartId: cart.id };
    });
  }
}
