"use strict";

import type { RequestHandler } from "express";

import { COOKIES, buildCookie, appendCookie } from "../support/cookies";
import { authPolicy } from "../../../application/identity";

const { GUEST_CART_TTL_MS } = authPolicy;

/**
 * Misafir sepetinin kimliğini çerezde taşır.
 *
 * Kullanıcı kayıt olmadan sepet doldurabilir; sepet sunucuda durduğu için
 * içeriği istemci tarafından değiştirilemez. Giriş ya da kayıt sırasında bu
 * kimlik SignIn/RegisterUser komutlarına verilir ve sepet kullanıcının
 * sepetiyle birleştirilir — hiçbir ürün kaybolmaz.
 */
export function cartSession({ cookieSecure }: { cookieSecure: boolean }): RequestHandler {
  return (req, res, next) => {
    req.guestCartId = req.auth?.userId ? null : req.cookies[COOKIES.CART] || null;

    /** Yeni bir misafir sepeti açıldığında çerezi günceller. */
    res.rememberGuestCart = (cartId) => {
      if (!cartId || req.auth?.userId || cartId === req.guestCartId) return;
      appendCookie(
        res,
        buildCookie(COOKIES.CART, cartId, {
          maxAgeSeconds: GUEST_CART_TTL_MS / 1000,
          secure: cookieSecure,
          sameSite: "Lax"
        })
      );
    };
    next();
  };
}
