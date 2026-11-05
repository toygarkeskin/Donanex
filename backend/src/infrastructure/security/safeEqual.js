"use strict";

const crypto = require("crypto");

/** Zamanlama saldırısına dayanıklı string karşılaştırması. */
function safeEqual(a, b) {
  const first = crypto.createHash("sha256").update(String(a)).digest();
  const second = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(first, second);
}

module.exports = { safeEqual };
