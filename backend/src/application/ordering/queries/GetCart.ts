"use strict";

import { Query, type Handler } from "../../shared/cqrs/Message";
import { Money } from "../../../domain/shared/Money";
import { Cart, type CartProduct, type CartView } from "../../../domain/ordering/Cart";
import type { CartReadModel } from "../../shared/contracts";

export class GetCartQuery extends Query {
  readonly userId: string | null;
  readonly guestCartId: string | null;

  constructor(input?: { userId?: string | null; guestCartId?: string | null }) {
    super();
    this.userId = input?.userId ?? null;
    this.guestCartId = input?.guestCartId ?? null;
  }
}

export type CartResponse = CartView & { cartId?: string };

/**
 * Sepeti güncel fiyat ve stok bilgisiyle döndürür.
 * Satışta olmayan ya da stoğu yetmeyen satırlar uyarıyla işaretlenir;
 * kullanıcı sepete bakarken sorunu görür ve ödeme adımında sürprizle karşılaşmaz.
 */
export class GetCartHandler implements Handler<GetCartQuery, CartResponse> {
  private readonly readModel: CartReadModel;

  constructor({ cartReadModel }: { cartReadModel: CartReadModel }) {
    this.readModel = cartReadModel;
  }

  async handle({ userId, guestCartId }: GetCartQuery): Promise<CartResponse> {
    const empty: CartView = {
      items: [],
      itemCount: 0,
      subtotal: Money.zero().toJSON(),
      hasIssues: false,
      canCheckout: false
    };

    const cartId = await this.readModel.findCartId({ userId, guestCartId });
    if (!cartId) return empty;

    const { lines, products } = await this.readModel.getLines(cartId);
    if (!lines.length) return empty;

    // Fiyat satırda değil, güncel üründen gelir: istemci fiyat belirleyemez.
    const view = new Cart(
      lines,
      new Map<string, CartProduct>(
        products.map((product) => [
          product.id,
          { ...product, price: Money.fromCents(product.priceCents) } as unknown as CartProduct
        ])
      )
    ).toView();

    return { ...view, cartId };
  }
}
