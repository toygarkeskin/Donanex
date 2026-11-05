"use strict";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ID_PATTERN = /^\d+$/;
const PHONE_PATTERN = /^[0-9+()\-\s]{7,30}$/;
const MAX_ID = 2_147_483_647;

function isNonEmptyString(value, maxLength) {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    (maxLength === undefined || value.trim().length <= maxLength)
  );
}

function isEmail(value) {
  return typeof value === "string" && value.trim().length <= 254 && EMAIL_PATTERN.test(value.trim());
}

function isPhone(value) {
  return typeof value === "string" && PHONE_PATTERN.test(value.trim());
}

/** Pozitif, veritabanı sınırlarında bir kimlik mi? (taşma 500 hatasına yol açmasın) */
function isId(value) {
  return ID_PATTERN.test(String(value ?? "")) && Number(value) > 0 && Number(value) <= MAX_ID;
}

module.exports = { isNonEmptyString, isEmail, isPhone, isId };
