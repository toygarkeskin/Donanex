"use strict";

const CLIENT = `
  client_id AS "clientId", name, secret_hash AS "secretHash",
  redirect_uris AS "redirectUris", grant_types AS "grantTypes", scopes,
  is_confidential AS "isConfidential", is_first_party AS "isFirstParty"`;

const REFRESH = `
  id, family_id AS "familyId", user_id AS "userId", client_id AS "clientId",
  session_id AS "sessionId", scope, expires_at AS "expiresAt",
  used_at AS "usedAt", revoked_at AS "revokedAt"`;

class PgOAuthRepository {
  constructor(client) {
    this.db = client;
  }

  async findClient(clientId) {
    if (typeof clientId !== "string" || !clientId) return null;
    const { rows } = await this.db.query(`SELECT ${CLIENT} FROM oauth_clients WHERE client_id = $1`, [clientId]);
    return rows[0] || null;
  }

  async saveAuthorizationCode(code) {
    await this.db.query(
      `INSERT INTO oauth_authorization_codes
         (code_hash, client_id, user_id, session_id, redirect_uri, scope, nonce, code_challenge, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [code.codeHash, code.clientId, code.userId, code.sessionId, code.redirectUri, code.scope, code.nonce, code.codeChallenge, code.expiresAt]
    );
  }

  /**
   * Kodu atomik olarak tüketir: DELETE ... RETURNING sayesinde aynı kod iki
   * istek tarafından aynı anda kullanılamaz.
   */
  async consumeAuthorizationCode(codeHash, now) {
    const { rows } = await this.db.query(
      `DELETE FROM oauth_authorization_codes
       WHERE code_hash = $1 AND expires_at > $2
       RETURNING client_id AS "clientId", user_id AS "userId", session_id AS "sessionId",
                 redirect_uri AS "redirectUri", scope, nonce, code_challenge AS "codeChallenge"`,
      [codeHash, now]
    );
    // Süresi dolmuş kodları da temizle.
    await this.db.query("DELETE FROM oauth_authorization_codes WHERE expires_at < $1", [now]);
    return rows[0] || null;
  }

  async saveRefreshToken(token) {
    await this.db.query(
      `INSERT INTO oauth_refresh_tokens
         (id, family_id, user_id, client_id, session_id, scope, token_hash, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [token.id, token.familyId, token.userId, token.clientId, token.sessionId, token.scope, token.tokenHash, token.expiresAt]
    );
  }

  async findRefreshTokenByHash(tokenHash) {
    const { rows } = await this.db.query(
      `SELECT ${REFRESH} FROM oauth_refresh_tokens WHERE token_hash = $1`,
      [tokenHash]
    );
    return rows[0] || null;
  }

  async markRefreshTokenUsed(id, now) {
    await this.db.query("UPDATE oauth_refresh_tokens SET used_at = $1 WHERE id = $2", [now, id]);
  }

  /** Jeton tekrar kullanıldığında tüm zinciri iptal eder. */
  async revokeRefreshTokenFamily(familyId) {
    await this.db.query(
      "UPDATE oauth_refresh_tokens SET revoked_at = NOW() WHERE family_id = $1 AND revoked_at IS NULL",
      [familyId]
    );
  }

  async revokeRefreshTokensForUser(userId) {
    await this.db.query(
      "UPDATE oauth_refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL",
      [userId]
    );
  }

  async revokeRefreshTokensForSession(sessionId) {
    if (!sessionId) return;
    await this.db.query(
      "UPDATE oauth_refresh_tokens SET revoked_at = NOW() WHERE session_id = $1 AND revoked_at IS NULL",
      [sessionId]
    );
  }

  async upsertClient(client) {
    await this.db.query(
      `INSERT INTO oauth_clients
         (client_id, name, secret_hash, redirect_uris, grant_types, scopes, is_confidential, is_first_party)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (client_id) DO UPDATE SET
         name = EXCLUDED.name,
         redirect_uris = EXCLUDED.redirect_uris,
         grant_types = EXCLUDED.grant_types,
         scopes = EXCLUDED.scopes,
         is_confidential = EXCLUDED.is_confidential,
         is_first_party = EXCLUDED.is_first_party`,
      [client.clientId, client.name, client.secretHash ?? null, client.redirectUris, client.grantTypes, client.scopes, client.isConfidential, client.isFirstParty]
    );
  }

  async purgeExpired() {
    await this.db.query("DELETE FROM oauth_authorization_codes WHERE expires_at < NOW()");
    await this.db.query("DELETE FROM oauth_refresh_tokens WHERE expires_at < NOW() - INTERVAL '7 days'");
  }
}

module.exports = { PgOAuthRepository };
