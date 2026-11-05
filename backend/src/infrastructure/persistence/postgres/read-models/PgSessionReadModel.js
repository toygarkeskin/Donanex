"use strict";

class PgSessionReadModel {
  constructor(pool) {
    this.db = pool;
  }

  async isRevoked(jti) {
    const { rows } = await this.db.query(
      "SELECT EXISTS (SELECT 1 FROM revoked_sessions WHERE jti = $1) AS revoked",
      [jti]
    );
    return rows[0].revoked;
  }
}

module.exports = { PgSessionReadModel };
