"use strict";

import type { RequestHandler } from "express";

import { COOKIES, buildCookie, appendCookie } from "../support/cookies";
import { authPolicy } from "../../../application/identity";

const { GUEST_CART_TTL_MS } = authPolicy;
const CART_HEADER = "X-Sepet";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    /*
     * Telefon uygulaması çerez saklamıyor; sepet kimliğini X-Sepet başlığıyla
     * taşıyor. Kimliğin gizliliği çerezdekiyle aynı (rastgele UUID); başlık
     * yalnızca çerez yoksa okunuyor, tarayıcının davranışı değişmiyor.
     */
    const baslik = req.get(CART_HEADER);
    const baslikteki = baslik && UUID.test(baslik) ? baslik : null;
    req.guestCartId = req.auth?.userId ? null : req.cookies[COOKIES.CART] || baslikteki;

    /** Yeni bir misafir sepeti açıldığında çerezi (ve uygulama için başlığı) günceller. */
    res.rememberGuestCart = (cartId) => {
      if (!cartId || req.auth?.userId || cartId === req.guestCartId) return;
      res.setHeader(CART_HEADER, cartId);
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
