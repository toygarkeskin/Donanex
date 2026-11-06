"use strict";

import { ValidationError } from "./errors";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PHONE_PATTERN = /^[0-9+()\-\s]{7,30}$/;

const isString = (value: unknown): value is string => typeof value === "string";

/*
 * Tip daraltıcılar (type guard): "value is string" imzası sayesinde bu
 * fonksiyondan geçen bir değer, çağıran tarafta artık string olarak bilinir.
 * Böylece doğrulama hem çalışma zamanında hem derlemede iş görür.
 */
export function isNonEmptyString(value: unknown, maxLength?: number): value is string {
  return (
    isString(value) && value.trim().length > 0 && (maxLength === undefined || value.trim().length <= maxLength)
  );
}

export const isEmail = (value: unknown): value is string =>
  isString(value) && value.trim().length <= 254 && EMAIL_PATTERN.test(value.trim());

export const isUuid = (value: unknown): value is string => isString(value) && UUID_PATTERN.test(value);

export const isSlug = (value: unknown): value is string =>
  isString(value) && value.length <= 120 && SLUG_PATTERN.test(value);

export const isPhone = (value: unknown): value is string => isString(value) && PHONE_PATTERN.test(value.trim());

export function isPositiveInteger(value: unknown, max: number = Number.MAX_SAFE_INTEGER): value is number {
  return Number.isInteger(value) && (value as number) > 0 && (value as number) <= max;
}

/** Metni URL'de kullanılabilir hale getirir; Türkçe harfleri karşılıklarına çevirir. */
export function slugify(text: unknown): string {
  const turkish: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" };
  return String(text)
    .toLowerCase()
    .replace(/[çğıöşü]/g, (char) => turkish[char] ?? char)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

/* ---------- Doğrula ya da hata fırlat ---------- */

export function requireText(value: unknown, field: string, maxLength?: number): string {
  if (!isNonEmptyString(value, maxLength)) {
    throw new ValidationError(`${field} zorunludur ve en fazla ${maxLength} karakter olabilir.`);
  }
  return value.trim();
}

export function optionalText(value: unknown, field: string, maxLength?: number): string | null {
  if (value === undefined || value === null || value === "") return null;
  return requireText(value, field, maxLength);
}

export function requireUuid(value: unknown, field: string): string {
  if (!isUuid(value)) throw new ValidationError(`${field} geçersiz.`);
  return value;
}

export function requireEmail(value: unknown, field = "E-posta"): string {
  if (!isEmail(value)) throw new ValidationError(`${field} geçerli bir adres olmalı.`);
  return value.trim().toLowerCase();
}

/*
 * Dönüş tipi "T": çağıran yerde değer, izin verilen değerler kümesinin
 * üyesi olarak bilinir. Örneğin requireEnum(x, Object.values(OrderStatus), …)
 * sonucu OrderStatus tipindedir, gevşek bir string değil.
 */
export function requireEnum<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  if (!allowed.includes(value as T)) throw new ValidationError(`${field} geçersiz.`);
  return value as T;
}

export function requireQuantity(value: unknown, field = "Adet", max = 99): number {
  const quantity = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
  if (!isPositiveInteger(quantity, max)) {
    throw new ValidationError(`${field} 1 ile ${max} arasında bir tam sayı olmalı.`);
  }
  return quantity;
}
