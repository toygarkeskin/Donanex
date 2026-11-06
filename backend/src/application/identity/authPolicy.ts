"use strict";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Oturum ve jeton süreleri tek yerde. Kısa ömürlü erişim jetonu + döndürülen
 * yenileme jetonu: çalınan bir jetonun kullanım ömrü dakikalarla sınırlı kalır.
 */
export const ACCESS_TOKEN_TTL_MS = 15 * MINUTE;
export const REFRESH_TOKEN_TTL_MS = 14 * DAY;
export const ID_TOKEN_TTL_MS = 15 * MINUTE;
/** Tarayıcıdaki tekil oturum (SSO): yeniden giriş istemeden jeton tazelemeye yarar. */
export const SSO_SESSION_TTL_MS = 14 * DAY;
export const AUTHORIZATION_CODE_TTL_MS = 2 * MINUTE;
export const PASSWORD_RESET_TTL_MS = 30 * MINUTE;
export const EMAIL_VERIFICATION_TTL_MS = 3 * DAY;
/** Misafir sepeti bu süre boyunca saklanır. */
export const GUEST_CART_TTL_MS = 30 * DAY;
/** Ödenmeyen sipariş bu sürenin sonunda iptal edilir ve stok iade edilir. */
export const UNPAID_ORDER_TTL_MINUTES = 60;
/** Yetki önbelleği; rol değişiminde anahtar silinir. */
export const ACCESS_POLICY_CACHE_TTL_SECONDS = 300;

/*
 * Presentation katmanı çerez ömrünü buradan okur. Varsayılan dışa aktarım
 * nesnesi, önceki `require("./authPolicy")` kullanımıyla aynı şekli korur.
 */
const authPolicy = Object.freeze({
  ACCESS_TOKEN_TTL_MS,
  REFRESH_TOKEN_TTL_MS,
  ID_TOKEN_TTL_MS,
  SSO_SESSION_TTL_MS,
  AUTHORIZATION_CODE_TTL_MS,
  PASSWORD_RESET_TTL_MS,
  EMAIL_VERIFICATION_TTL_MS,
  GUEST_CART_TTL_MS,
  UNPAID_ORDER_TTL_MINUTES,
  ACCESS_POLICY_CACHE_TTL_SECONDS
});

export default authPolicy;
export type AuthPolicy = typeof authPolicy;
