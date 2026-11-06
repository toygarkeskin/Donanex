"use strict";

import { Command, type Handler } from "../../shared/cqrs/Message";
import { resolveCart } from "../services/resolveCart";
import type { UnitOfWork } from "../../shared/contracts";

export class ClearCartCommand extends Command {
  readonly userId: string | null;
  readonly guestCartId: string | null;

  constructor(input?: { userId?: string | null; guestCartId?: string | null }) {
    super();
    this.userId = input?.userId ?? null;
    this.guestCartId = input?.guestCartId ?? null;
  }
}

export interface CartCleared {
  readonly cleared: boolean;
}

export class ClearCartHandler implements Handler<ClearCartCommand, CartCleared> {
  private readonly unitOfWork: UnitOfWork;

  constructor({ unitOfWork }: { unitOfWork: UnitOfWork }) {
    this.unitOfWork = unitOfWork;
  }

  async handle({ userId, guestCartId }: ClearCartCommand): Promise<CartCleared> {
    return this.unitOfWork.run(async (repos) => {
      const cart = await resolveCart(repos, { userId, guestCartId, create: false });
      if (cart) await repos.carts.replaceLines(cart.id, []);
      return { cleared: Boolean(cart) };
    });
  }
}
