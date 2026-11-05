"use strict";

const COLUMNS = `id, user_id AS "userId", expires_at AS "expiresAt", revoked_at AS "revokedAt"`;

class PgAuthSessionRepository {
  constructor(client) {
    this.db = client;
  }

  async create({ userId, tokenHash, expiresAt, ip, userAgent }) {
    const { rows } = await this.db.query(
      `INSERT INTO auth_sessions (id, user_id, token_hash, expires_at, ip, user_agent)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
       RETURNING ${COLUMNS}`,
      [userId, tokenHash, expiresAt, ip, userAgent ? String(userAgent).slice(0, 300) : null]
    );
    return rows[0];
  }

  async findByTokenHash(tokenHash) {
    const { rows } = await this.db.query(
      `SELECT ${COLUMNS} FROM auth_sessions WHERE token_hash = $1`,
      [tokenHash]
    );
    return rows[0] || null;
  }

  async findActiveByTokenHash(tokenHash, now) {
    const { rows } = await this.db.query(
      `SELECT ${COLUMNS} FROM auth_sessions
       WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > $2`,
      [tokenHash, now]
    );
    return rows[0] || null;
  }

  async findActiveById(id, now) {
    if (!id) return null;
    const { rows } = await this.db.query(
      `SELECT ${COLUMNS} FROM auth_sessions
       WHERE id = $1 AND revoked_at IS NULL AND expires_at > $2`,
      [id, now]
    );
    return rows[0] || null;
  }

  async revoke(id) {
    if (!id) return;
    await this.db.query("UPDATE auth_sessions SET revoked_at = NOW() WHERE id = $1 AND revoked_at IS NULL", [id]);
  }

  async revokeAllForUser(userId) {
    await this.db.query(
      "UPDATE auth_sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL",
      [userId]
    );
  }

  async purgeExpired() {
    await this.db.query("DELETE FROM auth_sessions WHERE expires_at < NOW() - INTERVAL '7 days'");
  }
}

module.exports = { PgAuthSessionRepository };
