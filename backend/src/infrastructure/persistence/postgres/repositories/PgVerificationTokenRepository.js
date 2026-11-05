"use strict";

class PgVerificationTokenRepository {
  constructor(client) {
    this.db = client;
  }

  /** Aynı amaç için kullanıcının önceki jetonlarını geçersiz kılar. */
  async replace({ purpose, userId, tokenHash, expiresAt }) {
    await this.db.query("DELETE FROM verification_tokens WHERE purpose = $1 AND user_id = $2", [purpose, userId]);
    await this.db.query(
      "INSERT INTO verification_tokens (purpose, token_hash, user_id, expires_at) VALUES ($1, $2, $3, $4)",
      [purpose, tokenHash, userId, expiresAt]
    );
  }

  /** Tek kullanımlık: DELETE ... RETURNING ile aynı jeton ikinci kez kullanılamaz. */
  async consume(purpose, tokenHash, now) {
    const { rows } = await this.db.query(
      `DELETE FROM verification_tokens
       WHERE purpose = $1 AND token_hash = $2 AND expires_at > $3
       RETURNING user_id AS "userId"`,
      [purpose, tokenHash, now]
    );
    return rows[0] || null;
  }

  async purgeExpired() {
    await this.db.query("DELETE FROM verification_tokens WHERE expires_at < NOW()");
  }
}

module.exports = { PgVerificationTokenRepository };
