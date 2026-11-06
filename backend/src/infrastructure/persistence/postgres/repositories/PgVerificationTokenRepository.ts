"use strict";

import type { Db } from "../pool";
import type { Row, VerificationTokenRepository } from "../../../../application/shared/contracts";

export class PgVerificationTokenRepository implements VerificationTokenRepository {
  private readonly db: Db;

  constructor(client: Db) {
    this.db = client;
  }

  /** Aynı amaç için kullanıcının önceki jetonlarını geçersiz kılar. */
  async replace({
    purpose,
    userId,
    tokenHash,
    expiresAt
  }: {
    purpose: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.db.query("DELETE FROM verification_tokens WHERE purpose = $1 AND user_id = $2", [purpose, userId]);
    await this.db.query(
      "INSERT INTO verification_tokens (purpose, token_hash, user_id, expires_at) VALUES ($1, $2, $3, $4)",
      [purpose, tokenHash, userId, expiresAt]
    );
  }

  /** Tek kullanımlık: DELETE ... RETURNING ile aynı jeton ikinci kez kullanılamaz. */
  async consume(purpose: string, tokenHash: string, now: Date): Promise<Row | null> {
    const { rows } = await this.db.query(
      `DELETE FROM verification_tokens
       WHERE purpose = $1 AND token_hash = $2 AND expires_at > $3
       RETURNING user_id AS "userId"`,
      [purpose, tokenHash, now]
    );
    return rows[0] || null;
  }

  async purgeExpired(): Promise<void> {
    await this.db.query("DELETE FROM verification_tokens WHERE expires_at < NOW()");
  }
}
