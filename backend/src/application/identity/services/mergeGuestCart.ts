"use strict";

import { Cart, type CartLine } from "../../../domain/ordering/Cart";
import type { CartRepository } from "../../shared/contracts";

export interface MergeResult {
  readonly merged: number;
  readonly cartId?: string;
}

/**
 * Misafirken doldurulan sepeti, giriş yapan ya da yeni kayıt olan kullanıcının
 * sepetine taşır. Kullanıcı "kayıt olarak devam et" dediğinde sepetinin
 * kaybolmaması bu adıma bağlıdır.
 *
 * Aynı transaction içinde çalışır; iki sepette de olan ürünün adetleri toplanır.
 */
export async function mergeGuestCart(
  { carts }: { carts: CartRepository },
  { guestCartId, userId }: { guestCartId?: string | null; userId: string }
): Promise<MergeResult> {
  if (!guestCartId) return { merged: 0 };

  const guestCart = await carts.findById(guestCartId);
  // Başkasının hesabına bağlı bir sepet taşınmaz.
  if (!guestCart || guestCart.userId) return { merged: 0 };

  const guestLines = (await carts.listLines(guestCart.id)) as CartLine[];
  if (!guestLines.length) {
    await carts.remove(guestCart.id);
    return { merged: 0 };
  }

  const userCart = await carts.findOrCreateForUser(userId);
  const userLines = (await carts.listLines(userCart.id)) as CartLine[];

  await carts.replaceLines(userCart.id, Cart.merge(userLines, guestLines));
  await carts.remove(guestCart.id);

  return { merged: guestLines.length, cartId: userCart.id };
}
