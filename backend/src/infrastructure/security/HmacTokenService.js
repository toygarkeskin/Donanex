"use strict";

const crypto = require("crypto");
const { safeEqual } = require("./safeEqual");

/**
 * İmzalı, süreli oturum belirteci: base64url(payload) + "." + HMAC-SHA256 imzası.
 * "typ" alanı müşteri belirtecinin yönetici yerine kullanılmasını engeller;
 * "jti" tekil kimliği çıkışta belirtecin iptal edilebilmesini sağlar.
 */
class HmacTokenService {
  constructor(secret, now = () => Date.now()) {
    if (!secret || secret.length < 32) throw new Error("SESSION_SECRET en az 32 karakter olmalıdır.");
    this.secret = secret;
    this.now = now;
  }

  sign(data) {
    return crypto.createHmac("sha256", this.secret).update(data).digest("base64url");
  }

  issue(payload, ttlMs) {
    const body = Buffer.from(
      JSON.stringify({ ...payload, jti: crypto.randomUUID(), expiresAt: this.now() + ttlMs })
    ).toString("base64url");
    return `${body}.${this.sign(body)}`;
  }

  /** Geçerliyse payload'ı, değilse null döndürür. */
  verify(token, expectedType) {
    if (!token || typeof token !== "string" || token.length > 4096) return null;

    const parts = token.split(".");
    if (parts.length !== 2) return null;
    if (!safeEqual(parts[1], this.sign(parts[0]))) return null;

    try {
      const payload = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
      if (!payload || typeof payload.expiresAt !== "number" || payload.expiresAt < this.now()) return null;
      if (typeof payload.jti !== "string") return null;
      if (expectedType && payload.typ !== expectedType) return null;
      return payload;
    } catch {
      return null;
    }
  }
}

module.exports = { HmacTokenService };
