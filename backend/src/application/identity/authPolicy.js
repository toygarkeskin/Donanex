"use strict";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Oturum ve jeton süreleri tek yerde. Kısa ömürlü erişim jetonu + döndürülen
 * yenileme jetonu: çalınan bir jetonun kullanım ömrü dakikalarla sınırlı kalır.
 */
module.exports = Object.freeze({
  ACCESS_TOKEN_TTL_MS: 15 * MINUTE,
  REFRESH_TOKEN_TTL_MS: 14 * DAY,
  ID_TOKEN_TTL_MS: 15 * MINUTE,
  // Tarayıcıdaki tekil oturum (SSO): yeniden giriş istemeden jeton tazelemeye yarar
  SSO_SESSION_TTL_MS: 14 * DAY,
  AUTHORIZATION_CODE_TTL_MS: 2 * MINUTE,
  PASSWORD_RESET_TTL_MS: 30 * MINUTE,
  EMAIL_VERIFICATION_TTL_MS: 3 * DAY,
  // Misafir sepeti bu süre boyunca saklanır
  GUEST_CART_TTL_MS: 30 * DAY,
  // Ödenmeyen sipariş bu sürenin sonunda iptal edilir ve stok iade edilir
  UNPAID_ORDER_TTL_MINUTES: 60,
  // Yetki önbelleği; rol değişiminde anahtar silinir
  ACCESS_POLICY_CACHE_TTL_SECONDS: 300
});
