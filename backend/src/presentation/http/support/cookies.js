"use strict";

/**
 * Çerez adları ve üretimi tek yerde.
 *
 *  sso  — tarayıcı oturumu; /oauth/authorize adımında "zaten giriş yapılmış"
 *         demeye yarar. SameSite=Lax, çünkü OAuth yönlendirmesi üst düzey
 *         gezinmeyle gelir.
 *  rt   — yenileme jetonu. SameSite=Strict; yalnızca kendi sayfamızdan
 *         yapılan XHR ile kullanılır. Tarayıcıdaki JavaScript okuyamaz.
 *  cart — misafir sepetinin kimliği. Sepetin kendisi sunucudadır.
 *
 * Erişim jetonu ÇEREZDE TUTULMAZ: arayüz onu bellekte tutar, böylece
 * CSRF yüzeyi daralır ve jeton sekme kapanınca kaybolur.
 */
const COOKIES = Object.freeze({
  SSO: "dnx_sso",
  REFRESH: "dnx_rt",
  CART: "dnx_cart"
});

function parseCookies(req) {
  const result = Object.create(null);
  for (const part of (req.headers.cookie || "").split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    try {
      result[key] = decodeURIComponent(part.slice(index + 1).trim());
    } catch {
      /* bozuk çerez yok sayılır */
    }
  }
  return result;
}

/** maxAgeSeconds null ise tarayıcı kapanınca silinen oturum çerezi olur. */
function buildCookie(name, value, { maxAgeSeconds = null, secure, sameSite = "Strict", path = "/" } = {}) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "HttpOnly",
    `SameSite=${sameSite}`,
    `Path=${path}`
  ];
  if (maxAgeSeconds !== null) parts.push(`Max-Age=${Math.floor(maxAgeSeconds)}`);
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

const clearCookie = (name, options) => buildCookie(name, "", { ...options, maxAgeSeconds: 0 });

/** Aynı yanıtta birden çok çerez gönderebilmek için. */
function appendCookie(res, cookie) {
  const existing = res.getHeader("Set-Cookie");
  if (!existing) res.setHeader("Set-Cookie", [cookie]);
  else res.setHeader("Set-Cookie", [...(Array.isArray(existing) ? existing : [existing]), cookie]);
}

module.exports = { COOKIES, parseCookies, buildCookie, clearCookie, appendCookie };
