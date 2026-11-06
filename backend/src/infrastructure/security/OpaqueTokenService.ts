"use strict";

import crypto from "node:crypto";
import type { OpaqueTokens } from "../../application/shared/contracts";

/**
 * Tahmin edilemez tek kullanımlık kodlar: oturum çerezi, yenileme jetonu,
 * yetkilendirme kodu, sipariş takip kodu, parola sıfırlama bağlantısı.
 *
 * Açık hali kullanıcıya bir kez verilir; veritabanında yalnızca HMAC özeti
 * tutulur. Veritabanı sızsa bile özetlerden jeton üretilemez — düz SHA-256
 * yerine gizli anahtarlı HMAC kullanılmasının nedeni budur.
 */
export class OpaqueTokenService implements OpaqueTokens {
  private readonly pepper: string;

  constructor(pepper: string) {
    if (!pepper || pepper.length < 32) {
      throw new Error("TOKEN_PEPPER en az 32 karakter olmalı.");
    }
    this.pepper = pepper;
  }

  generate(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  hash(token: unknown): string {
    return crypto.createHmac("sha256", this.pepper).update(String(token)).digest("hex");
  }

  isWellFormed(token: unknown): token is string {
    return typeof token === "string" && /^[a-f0-9]{64}$/.test(token);
  }
}
