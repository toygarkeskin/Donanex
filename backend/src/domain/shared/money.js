"use strict";

const MAX_CENTS = 999_999_999_999; // NUMERIC(12, 2) sınırı

/** Fiyatı kuruşa çevirir; kayan nokta hatalarını önlemek için tüm hesaplar kuruşla yapılır. */
function toCents(value) {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && value.trim() === "") return null;

  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return null;

  const cents = Math.round(number * 100);
  return Number.isSafeInteger(cents) && cents <= MAX_CENTS ? cents : null;
}

function centsToDecimalString(cents) {
  return (cents / 100).toFixed(2);
}

module.exports = { toCents, centsToDecimalString };
