"use strict";

const crypto = require("crypto");

/**
 * Tahmin edilemez tek kullanımlık kodlar (sipariş takip kodu, parola sıfırlama).
 * Açık hali kullanıcıya bir kez verilir; veritabanında SHA-256 özeti tutulur.
 */
class OpaqueTokenService {
  generate() {
    return crypto.randomBytes(24).toString("hex");
  }

  hash(code) {
    return crypto.createHash("sha256").update(code).digest("hex");
  }

  isWellFormed(code) {
    return typeof code === "string" && /^[a-f0-9]{48}$/.test(code);
  }
}

module.exports = { OpaqueTokenService };
