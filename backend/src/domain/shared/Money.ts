"use strict";

import { ValidationError } from "./errors";

export const MAX_CENTS = 99_999_999_999; // NUMERIC(13,2) sınırı
export const CURRENCY = "TRY";

/** Money.toJSON() çıktısı — API yanıtlarında bu şekil görünür. */
export interface MoneyView {
  amount: string;
  currency: typeof CURRENCY;
  cents: number;
}

/**
 * Para birimi değer nesnesi. Tüm hesaplar kuruş (tam sayı) üzerinden yapılır;
 * kayan nokta hatası hiçbir tutara bulaşmaz.
 */
export class Money {
  readonly cents: number;

  constructor(cents: number) {
    if (!Number.isSafeInteger(cents) || cents < 0 || cents > MAX_CENTS) {
      throw new ValidationError("Tutar geçersiz.");
    }
    this.cents = cents;
    Object.freeze(this);
  }

  /**
   * "19.99" / 19.99 / 1999 kuruş değil — kullanıcıya gösterilen birim değerden kurar.
   *
   * Girdi bilerek "unknown": bu fonksiyon istemciden gelen ham veriyle de
   * çağrılır, dolayısıyla tipine güvenemez; denetimi kendisi yapar.
   */
  static fromAmount(value: unknown, field = "Tutar"): Money {
    if (typeof value !== "number" && typeof value !== "string") {
      throw new ValidationError(`${field} geçersiz.`);
    }
    const text = String(value).trim().replace(",", ".");
    if (text === "" || !/^\d+(\.\d{1,2})?$/.test(text)) {
      throw new ValidationError(`${field} 0 veya daha büyük, en fazla iki ondalıklı bir sayı olmalı.`);
    }
    return new Money(Math.round(Number(text) * 100));
  }

  static fromCents(cents: number): Money {
    return new Money(cents);
  }

  static zero(): Money {
    return new Money(0);
  }

  static sum(amounts: readonly Money[]): Money {
    return amounts.reduce<Money>((total, money) => total.add(money), Money.zero());
  }

  add(other: Money): Money {
    return new Money(this.cents + other.cents);
  }

  multiply(factor: number): Money {
    if (!Number.isInteger(factor) || factor < 0) throw new ValidationError("Çarpan geçersiz.");
    return new Money(this.cents * factor);
  }

  isZero(): boolean {
    return this.cents === 0;
  }

  /** Veritabanının NUMERIC sütununa yazılacak biçim. */
  toDecimalString(): string {
    return (this.cents / 100).toFixed(2);
  }

  toJSON(): MoneyView {
    return { amount: this.toDecimalString(), currency: CURRENCY, cents: this.cents };
  }
}
