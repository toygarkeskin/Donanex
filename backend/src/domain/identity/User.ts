"use strict";

import { ValidationError } from "../shared/errors";
import { requireText, requireEmail, optionalText, isPhone } from "../shared/guards";

export const UserStatus = {
  ACTIVE: "active",
  SUSPENDED: "suspended"
} as const;

export type UserStatusKind = (typeof UserStatus)[keyof typeof UserStatus];

export const MIN_PASSWORD_LENGTH = 10;
const MAX_PASSWORD_LENGTH = 200;

/** En sık kullanılan parolalar; uzunluk kuralını geçseler de kabul edilmez. */
const COMMON_PASSWORDS = new Set([
  "password12",
  "parola1234",
  "1234567890",
  "qwerty1234",
  "qwertyuiop",
  "password123",
  "sifre12345",
  "admin12345",
  "123456789a",
  "iloveyou12"
]);

/**
 * Parola kuralı tek yerde tanımlıdır; kayıt, parola değiştirme ve
 * sıfırlama aynı kuralı kullanır.
 */
export function assertPasswordStrength(password: unknown, { email }: { email?: string } = {}): string {
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
  const yerelKisim = email ? String(email).split("@")[0] : "";
  if (yerelKisim && password.toLowerCase().includes(yerelKisim.toLowerCase())) {
    throw new ValidationError("Parola e-posta adresinizi içeremez.");
  }
  return password;
}

export interface RegistrationInput {
  email?: unknown;
  fullName?: unknown;
  password?: unknown;
  phone?: unknown;
}

export interface Registration {
  readonly email: string;
  readonly fullName: string;
  readonly password: string;
  readonly phone: string | null;
}

/** Kayıt formu. Parola burada doğrulanır, özeti application katmanında alınır. */
export function validateRegistration(input?: RegistrationInput | null): Registration {
  const data = input ?? {};
  const email = requireEmail(data.email);
  return {
    email,
    fullName: requireText(data.fullName, "Ad Soyad", 150),
    password: assertPasswordStrength(data.password, { email }),
    phone: validateOptionalPhone(data.phone)
  };
}

export function validateOptionalPhone(phone: unknown): string | null {
  if (phone === undefined || phone === null || phone === "") return null;
  if (!isPhone(phone)) throw new ValidationError("Telefon numarası geçersiz.");
  return phone.trim();
}

export interface ProfileUpdate {
  readonly fullName: string;
  readonly phone: string | null;
}

export function validateProfileUpdate(input?: { fullName?: unknown; phone?: unknown } | null): ProfileUpdate {
  const data = input ?? {};
  return {
    fullName: requireText(data.fullName, "Ad Soyad", 150),
    phone: validateOptionalPhone(data.phone)
  };
}

export interface AddressInput {
  title?: unknown;
  fullName?: unknown;
  phone?: unknown;
  city?: unknown;
  district?: unknown;
  line?: unknown;
  postalCode?: unknown;
}

export interface Address {
  readonly title: string;
  readonly fullName: string;
  readonly phone: string;
  readonly city: string;
  readonly district: string;
  readonly line: string;
  readonly postalCode: string | null;
}

/** Teslimat adresi değer nesnesi. */
export function createAddress(input?: AddressInput | null): Address {
  const data = input ?? {};
  if (!isPhone(data.phone)) throw new ValidationError("Telefon numarası geçersiz.");
  return Object.freeze({
    title: optionalText(data.title, "Adres başlığı", 60) || "Adresim",
    fullName: requireText(data.fullName, "Ad Soyad", 150),
    phone: data.phone.trim(),
    city: requireText(data.city, "İl", 80),
    district: requireText(data.district, "İlçe", 80),
    line: requireText(data.line, "Açık adres", 500),
    postalCode: optionalText(data.postalCode, "Posta kodu", 20)
  });
}
