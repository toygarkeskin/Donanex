"use strict";

const { ValidationError } = require("../shared/errors");
const { isNonEmptyString, isEmail, isPhone } = require("../shared/guards");

const normalizeEmail = (email) => String(email).trim().toLowerCase();

function assertName(name) {
  if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 150) {
    throw new ValidationError("Ad en az 2, en fazla 150 karakter olmalı.");
  }
  return name.trim();
}

/** Yeni parola kuralı: 8-128 karakter, en az bir harf ve bir rakam. */
function assertNewPassword(password) {
  if (typeof password !== "string" || password.length < 8 || password.length > 128) {
    throw new ValidationError("Şifre 8-128 karakter arasında olmalı.");
  }
  if (!/\p{L}/u.test(password) || !/\d/.test(password)) {
    throw new ValidationError("Şifre en az bir harf ve bir rakam içermeli.");
  }
  return password;
}

function assertEmail(email) {
  if (!isEmail(email)) throw new ValidationError("Geçerli bir e-posta gir.");
  return normalizeEmail(email);
}

function validateRegistration(input) {
  const { name, email, password } = input || {};
  return { name: assertName(name), email: assertEmail(email), password: assertNewPassword(password) };
}

function validateLogin(input) {
  const { email, password } = input || {};
  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    email.length > 254 ||
    password.length > 128
  ) {
    throw new ValidationError("E-posta ve şifre gir.");
  }
  return { email: normalizeEmail(email), password };
}

/** Kayıtlı teslimat adresi değer nesnesi. */
function createAddress(input) {
  const { fullName, phone, address } = input || {};
  const valid = isNonEmptyString(fullName, 150) && isPhone(phone) && isNonEmptyString(address, 1000);
  if (!valid) throw new ValidationError("Lütfen adres bilgilerini kontrol edin.");

  return Object.freeze({
    fullName: fullName.trim(),
    phone: phone.trim(),
    address: address.trim()
  });
}

module.exports = {
  validateRegistration,
  validateLogin,
  createAddress,
  normalizeEmail,
  assertName,
  assertEmail,
  assertNewPassword
};
