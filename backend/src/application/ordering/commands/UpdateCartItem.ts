"use strict";

import { Command, type Handler } from "../../shared/cqrs/Message";
import { NotFoundError, ConflictError } from "../../../domain/shared/errors";
import { requireUuid, requireQuantity } from "../../../domain/shared/guards";
import { MAX_QUANTITY_PER_ITEM } from "../../../domain/ordering/Cart";
import { resolveCart } from "../services/resolveCart";
import type { UnitOfWork } from "../../shared/contracts";

export class UpdateCartItemCommand extends Command {
  readonly userId: string | null;
  readonly guestCartId: string | null;
  readonly productId: string;
  readonly quantity: unknown;

  constructor(input?: { userId?: string | null; guestCartId?: string | null; productId?: string; quantity?: unknown }) {
    super();
    this.userId = input?.userId ?? null;
    this.guestCartId = input?.guestCartId ?? null;
    this.productId = input?.productId as string;
    this.quantity = input?.quantity;
  }
}

export interface CartUpdated {
  readonly cartId: string;
}

export class UpdateCartItemHandler implements Handler<UpdateCartItemCommand, CartUpdated> {
  private readonly unitOfWork: UnitOfWork;

  constructor({ unitOfWork }: { unitOfWork: UnitOfWork }) {
    this.unitOfWork = unitOfWork;
  }

  async handle({ userId, guestCartId, productId, quantity }: UpdateCartItemCommand): Promise<CartUpdated> {
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
