"use strict";

import type { CartRepository, Row } from "../../shared/contracts";

/**
 * Sepeti bulur ya da açar.
 *
 * Kayıtsız kullanıcının sepeti de sunucuda tutulur; tarayıcıda yalnızca
 * sepetin kimliği (httpOnly çerez) bulunur. Böylece misafir sepeti cihaz
 * değişse de kaybolmaz, giriş yapıldığında kullanıcının sepetiyle birleşir
 * ve sepet içeriği istemci tarafından değiştirilemez.
 */
export async function resolveCart(
  { carts }: { carts: CartRepository },
  {
    userId,
    guestCartId,
    create = true
  }: { userId?: string | null; guestCartId?: string | null; create?: boolean }
): Promise<Row | null> {
  if (userId) {
    return create ? carts.findOrCreateForUser(userId) : carts.findByUser(userId);
  }
  if (guestCartId) {
    const existing = await carts.findById(guestCartId);
    // Başkasının hesabına bağlanmış bir sepet misafire verilmez.
    if (existing && !existing.userId) return existing;
  }
  return create ? carts.createGuestCart() : null;
}
