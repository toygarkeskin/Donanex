"use strict";

import type { Request, Response } from "express";

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
export const COOKIES = Object.freeze({
  SSO: "dnx_sso",
  REFRESH: "dnx_rt",
  CART: "dnx_cart"
});

export function parseCookies(req: Request): Record<string, string> {
  // Object.create(null): "constructor" ya da "__proto__" adlı bir çerez
  // prototipe dokunamaz.
  const result: Record<string, string> = Object.create(null);
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

export interface CookieOptions {
  /** null ise tarayıcı kapanınca silinen oturum çerezi olur. */
  readonly maxAgeSeconds?: number | null;
  readonly secure?: boolean;
  readonly sameSite?: "Strict" | "Lax" | "None";
  readonly path?: string;
}

/** HttpOnly her zaman açık: çerezleri sayfadaki JavaScript okuyamaz. */
export function buildCookie(
  name: string,
  value: string,
  { maxAgeSeconds = null, secure, sameSite = "Strict", path = "/" }: CookieOptions = {}
): string {
  const parts = [`${name}=${encodeURIComponent(value)}`, "HttpOnly", `SameSite=${sameSite}`, `Path=${path}`];
  if (maxAgeSeconds !== null) parts.push(`Max-Age=${Math.floor(maxAgeSeconds)}`);
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export const clearCookie = (name: string, options?: CookieOptions): string =>
  buildCookie(name, "", { ...options, maxAgeSeconds: 0 });

/** Aynı yanıtta birden çok çerez gönderebilmek için. */
export function appendCookie(res: Response, cookie: string): void {
  const existing = res.getHeader("Set-Cookie");
  if (!existing) res.setHeader("Set-Cookie", [cookie]);
  else res.setHeader("Set-Cookie", [...(Array.isArray(existing) ? existing : [String(existing)]), cookie]);
}
