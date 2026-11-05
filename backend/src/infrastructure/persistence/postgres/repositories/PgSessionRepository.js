"use strict";

class PgSessionRepository {
  constructor(client) {
    this.db = client;
  }

  async revoke(jti, expiresAt) {
    await this.db.query(
      "INSERT INTO revoked_sessions (jti, expires_at) VALUES ($1, $2) ON CONFLICT (jti) DO NOTHING",
      [jti, expiresAt]
    );
  }

  async purgeExpired() {
    await this.db.query("DELETE FROM revoked_sessions WHERE expires_at < NOW()");
  }
}

module.exports = { PgSessionRepository };
