"use strict";

const { ValidationError } = require("../shared/errors");
const { requireText, requireEmail, optionalText, isPhone } = require("../shared/guards");

const UserStatus = Object.freeze({
  ACTIVE: "active",
  SUSPENDED: "suspended"
});

const MIN_PASSWORD_LENGTH = 10;
const MAX_PASSWORD_LENGTH = 200;

/** En sık kullanılan parolalar; uzunluk kuralını geçseler de kabul edilmez. */
const COMMON_PASSWORDS = new Set([
  "password12", "parola1234", "1234567890", "qwerty1234", "qwertyuiop",
  "password123", "sifre12345", "admin12345", "123456789a", "iloveyou12"
]);

/**
 * Parola kuralı tek yerde tanımlıdır; kayıt, parola değiştirme ve
 * sıfırlama aynı kuralı kullanır.
 */
function assertPasswordStrength(password, { email } = {}) {
  if (typeof password !== "string") throw new ValidationError("Parola zorunludur.");
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new ValidationError(`Parola en az ${MIN_PASSWORD_LENGTH} karakter olmalı.`);
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    throw new ValidationError(`Parola en fazla ${MAX_PASSWORD_LENGTH} karakter olabilir.`);
  }
  if (!/\p{L}/u.test(password) || !/\d/.test(password)) {
    throw new ValidationError("Parola en az bir harf ve bir rakam içermeli.");
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    throw new ValidationError("Bu parola çok yaygın kullanılıyor, başka bir parola seçin.");
  }
  if (email && password.toLowerCase().includes(String(email).split("@")[0].toLowerCase())) {
    throw new ValidationError("Parola e-posta adresinizi içeremez.");
  }
  return password;
}

/** Kayıt formu. Parola burada doğrulanır, özeti application katmanında alınır. */
function validateRegistration(input) {
  const data = input || {};
  const email = requireEmail(data.email);
  return {
    email,
    fullName: requireText(data.fullName, "Ad Soyad", 150),
    password: assertPasswordStrength(data.password, { email }),
    phone: validateOptionalPhone(data.phone)
  };
}

function validateOptionalPhone(phone) {
  if (phone === undefined || phone === null || phone === "") return null;
  if (!isPhone(phone)) throw new ValidationError("Telefon numarası geçersiz.");
  return String(phone).trim();
}

function validateProfileUpdate(input) {
  const data = input || {};
  return {
    fullName: requireText(data.fullName, "Ad Soyad", 150),
    phone: validateOptionalPhone(data.phone)
  };
}

/** Teslimat adresi değer nesnesi. */
function createAddress(input) {
  const data = input || {};
  if (!isPhone(data.phone)) throw new ValidationError("Telefon numarası geçersiz.");
  return Object.freeze({
    title: optionalText(data.title, "Adres başlığı", 60) || "Adresim",
    fullName: requireText(data.fullName, "Ad Soyad", 150),
    phone: String(data.phone).trim(),
    city: requireText(data.city, "İl", 80),
    district: requireText(data.district, "İlçe", 80),
    line: requireText(data.line, "Açık adres", 500),
    postalCode: optionalText(data.postalCode, "Posta kodu", 20)
  });
}

module.exports = {
  UserStatus,
  MIN_PASSWORD_LENGTH,
  assertPasswordStrength,
  validateRegistration,
  validateProfileUpdate,
  validateOptionalPhone,
  createAddress
};
