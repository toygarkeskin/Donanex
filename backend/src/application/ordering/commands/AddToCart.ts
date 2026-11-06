"use strict";

import { Command, type Handler } from "../../shared/cqrs/Message";
import { NotFoundError, ConflictError } from "../../../domain/shared/errors";
import { requireUuid, requireQuantity } from "../../../domain/shared/guards";
import { Cart, MAX_QUANTITY_PER_ITEM, type CartLine } from "../../../domain/ordering/Cart";
import { resolveCart } from "../services/resolveCart";
import type { UnitOfWork } from "../../shared/contracts";

export class AddToCartCommand extends Command {
  readonly userId: string | null;
  readonly guestCartId: string | null;
  readonly productId: string;
  readonly quantity: unknown;

  constructor(input?: { userId?: string | null; guestCartId?: string | null; productId?: string; quantity?: unknown }) {
    super();
    this.userId = input?.userId ?? null;
    this.guestCartId = input?.guestCartId ?? null;
    this.productId = input?.productId as string;
    this.quantity = input?.quantity ?? 1;
  }
}

export interface CartTouched {
  readonly cartId: string;
  readonly isGuestCart: boolean;
}

/**
 * Sepete ürün ekler. Kayıt ZORUNLU DEĞİLDİR: misafir de sepet oluşturabilir.
 * Ürünün satışta ve stokta olduğu sunucuda doğrulanır.
 */
export class AddToCartHandler implements Handler<AddToCartCommand, CartTouched> {
  private readonly unitOfWork: UnitOfWork;

  constructor({ unitOfWork }: { unitOfWork: UnitOfWork }) {
    this.unitOfWork = unitOfWork;
  }

  async handle({ userId, guestCartId, productId, quantity }: AddToCartCommand): Promise<CartTouched> {
    requireUuid(productId, "Ürün numarası");
    const amount = requireQuantity(quantity, "Adet", MAX_QUANTITY_PER_ITEM);

    return this.unitOfWork.run(async (repos) => {
      const product = await repos.products.findPurchasable(productId);
      if (!product) throw new NotFoundError("Ürün bulunamadı veya satışta değil.");

      const cart = (await resolveCart(repos, { userId, guestCartId }))!;
      const lines = (await repos.carts.listLines(cart.id)) as CartLine[];
      const total = Cart.assertCanAdd(lines, productId, amount);

      if (product.stock < total) {
        throw new ConflictError(`Bu üründen en fazla ${product.stock} adet alabilirsiniz.`);
      }

      await repos.carts.setLine(cart.id, productId, total);
      return { cartId: cart.id, isGuestCart: !userId };
    });
  }
}
