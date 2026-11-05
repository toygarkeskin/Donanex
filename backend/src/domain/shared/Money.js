"use strict";

const { ValidationError } = require("./errors");

const MAX_CENTS = 99_999_999_999; // NUMERIC(13,2) sınırı
const CURRENCY = "TRY";

/**
 * Para birimi değer nesnesi. Tüm hesaplar kuruş (tam sayı) üzerinden yapılır;
 * kayan nokta hatası hiçbir tutara bulaşmaz.
 */
class Money {
  constructor(cents) {
    if (!Number.isSafeInteger(cents) || cents < 0 || cents > MAX_CENTS) {
      throw new ValidationError("Tutar geçersiz.");
    }
    this.cents = cents;
    Object.freeze(this);
  }

  /** "19.99" / 19.99 / 1999 kuruş değil — kullanıcıya gösterilen birim değerden kurar. */
  static fromAmount(value, field = "Tutar") {
    if (typeof value !== "number" && typeof value !== "string") {
      throw new ValidationError(`${field} geçersiz.`);
    }
    const text = String(value).trim().replace(",", ".");
    if (text === "" || !/^\d+(\.\d{1,2})?$/.test(text)) {
      throw new ValidationError(`${field} 0 veya daha büyük, en fazla iki ondalıklı bir sayı olmalı.`);
    }
    return new Money(Math.round(Number(text) * 100));
  }

  static fromCents(cents) {
    return new Money(cents);
  }

  static zero() {
    return new Money(0);
  }

  static sum(amounts) {
    return amounts.reduce((total, money) => total.add(money), Money.zero());
  }

  add(other) {
    return new Money(this.cents + other.cents);
  }

  multiply(factor) {
    if (!Number.isInteger(factor) || factor < 0) throw new ValidationError("Çarpan geçersiz.");
    return new Money(this.cents * factor);
  }

  isZero() {
    return this.cents === 0;
  }

  /** Veritabanının NUMERIC sütununa yazılacak biçim. */
  toDecimalString() {
    return (this.cents / 100).toFixed(2);
  }

  toJSON() {
    return { amount: this.toDecimalString(), currency: CURRENCY, cents: this.cents };
  }
}

module.exports = { Money, CURRENCY, MAX_CENTS };
