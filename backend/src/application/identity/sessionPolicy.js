"use strict";

const HOUR = 60 * 60 * 1000;

module.exports = Object.freeze({
  ADMIN_SESSION_TTL_MS: 8 * HOUR,
  CUSTOMER_SESSION_TTL_MS: 8 * HOUR,
  REMEMBERED_SESSION_TTL_MS: 14 * 24 * HOUR,
  PASSWORD_RESET_TTL_MS: 30 * 60 * 1000,
  TOKEN_TYPES: Object.freeze({ ADMIN: "admin", CUSTOMER: "customer" })
});
