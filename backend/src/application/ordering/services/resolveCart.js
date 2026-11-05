"use strict";

/**
 * Sepeti bulur ya da açar.
 *
 * Kayıtsız kullanıcının sepeti de sunucuda tutulur; tarayıcıda yalnızca
 * sepetin kimliği (httpOnly çerez) bulunur. Böylece misafir sepeti cihaz
 * değişse de kaybolmaz, giriş yapıldığında kullanıcının sepetiyle birleşir
 * ve sepet içeriği istemci tarafından değiştirilemez.
 */
async function resolveCart({ carts }, { userId, guestCartId, create = true }) {
  if (userId) {
    return create ? carts.findOrCreateForUser(userId) : carts.findByUser(userId);
  }
  if (guestCartId) {
    const existing = await carts.findById(guestCartId);
    if (existing && !existing.userId) return existing;
  }
  return create ? carts.createGuestCart() : null;
}

module.exports = { resolveCart };
