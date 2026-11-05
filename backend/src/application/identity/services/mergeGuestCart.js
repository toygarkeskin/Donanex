"use strict";

const { Cart } = require("../../../domain/ordering/Cart");

/**
 * Misafirken doldurulan sepeti, giriş yapan ya da yeni kayıt olan kullanıcının
 * sepetine taşır. Kullanıcı "kayıt olarak devam et" dediğinde sepetinin
 * kaybolmaması bu adıma bağlıdır.
 *
 * Aynı transaction içinde çalışır; iki sepette de olan ürünün adetleri toplanır.
 */
async function mergeGuestCart({ carts }, { guestCartId, userId }) {
  if (!guestCartId) return { merged: 0 };

  const guestCart = await carts.findById(guestCartId);
  if (!guestCart || guestCart.userId) return { merged: 0 };

  const guestLines = await carts.listLines(guestCart.id);
  if (!guestLines.length) {
    await carts.remove(guestCart.id);
    return { merged: 0 };
  }

  const userCart = await carts.findOrCreateForUser(userId);
  const userLines = await carts.listLines(userCart.id);

  await carts.replaceLines(userCart.id, Cart.merge(userLines, guestLines));
  await carts.remove(guestCart.id);

  return { merged: guestLines.length, cartId: userCart.id };
}

module.exports = { mergeGuestCart };
