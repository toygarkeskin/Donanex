"use strict";

const { ValidationError } = require("./errors");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PHONE_PATTERN = /^[0-9+()\-\s]{7,30}$/;

const isString = (value) => typeof value === "string";

function isNonEmptyString(value, maxLength) {
  return (
    isString(value) &&
    value.trim().length > 0 &&
    (maxLength === undefined || value.trim().length <= maxLength)
  );
}

const isEmail = (value) => isString(value) && value.trim().length <= 254 && EMAIL_PATTERN.test(value.trim());
const isUuid = (value) => isString(value) && UUID_PATTERN.test(value);
const isSlug = (value) => isString(value) && value.length <= 120 && SLUG_PATTERN.test(value);
const isPhone = (value) => isString(value) && PHONE_PATTERN.test(value.trim());

function isPositiveInteger(value, max = Number.MAX_SAFE_INTEGER) {
  return Number.isInteger(value) && value > 0 && value <= max;
}

/** Metni URL'de kullanılabilir hale getirir; Türkçe harfleri karşılıklarına çevirir. */
function slugify(text) {
  const turkish = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" };
  return String(text)
    .toLowerCase()
    .replace(/[çğıöşü]/g, (char) => turkish[char])
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

/* ---------- Doğrula ya da hata fırlat ---------- */

function requireText(value, field, maxLength) {
  if (!isNonEmptyString(value, maxLength)) {
    throw new ValidationError(`${field} zorunludur ve en fazla ${maxLength} karakter olabilir.`);
  }
  return value.trim();
}

function optionalText(value, field, maxLength) {
  if (value === undefined || value === null || value === "") return null;
  return requireText(value, field, maxLength);
}

function requireUuid(value, field) {
  if (!isUuid(value)) throw new ValidationError(`${field} geçersiz.`);
  return value;
}

function requireEmail(value, field = "E-posta") {
  if (!isEmail(value)) throw new ValidationError(`${field} geçerli bir adres olmalı.`);
  return value.trim().toLowerCase();
}

function requireEnum(value, allowed, field) {
  if (!allowed.includes(value)) throw new ValidationError(`${field} geçersiz.`);
  return value;
}

function requireQuantity(value, field = "Adet", max = 99) {
  const quantity = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
  if (!isPositiveInteger(quantity, max)) {
    throw new ValidationError(`${field} 1 ile ${max} arasında bir tam sayı olmalı.`);
  }
  return quantity;
}

module.exports = {
  isNonEmptyString,
  isEmail,
  isUuid,
  isSlug,
  isPhone,
  isPositiveInteger,
  slugify,
  requireText,
  optionalText,
  requireUuid,
  requireEmail,
  requireEnum,
  requireQuantity
};
