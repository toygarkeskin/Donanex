"use strict";

const crypto = require("crypto");

/**
 * Tahmin edilemez tek kullanımlık kodlar: oturum çerezi, yenileme jetonu,
 * yetkilendirme kodu, sipariş takip kodu, parola sıfırlama bağlantısı.
 *
 * Açık hali kullanıcıya bir kez verilir; veritabanında yalnızca HMAC özeti
 * tutulur. Veritabanı sızsa bile özetlerden jeton üretilemez — düz SHA-256
 * yerine gizli anahtarlı HMAC kullanılmasının nedeni budur.
 */
class OpaqueTokenService {
  constructor(pepper) {
    if (!pepper || pepper.length < 32) {
      throw new Error("TOKEN_PEPPER en az 32 karakter olmalı.");
    }
    this.pepper = pepper;
  }

  generate() {
    return crypto.randomBytes(32).toString("hex");
  }

  hash(token) {
    return crypto.createHmac("sha256", this.pepper).update(String(token)).digest("hex");
  }

  isWellFormed(token) {
    return typeof token === "string" && /^[a-f0-9]{64}$/.test(token);
  }
}

module.exports = { OpaqueTokenService };
