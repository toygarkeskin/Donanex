"use strict";

import type { Db } from "../pool";
import type { LoginChallenge, LoginChallengeRepository } from "../../../../application/shared/contracts";

const ALANLAR = `id, user_id AS "userId", code_hash AS "codeHash", attempts, sends,
  last_sent_at AS "lastSentAt", expires_at AS "expiresAt"`;

/** Giriş kodları ve "bu cihazı hatırla" jetonları. */
export class PgLoginChallengeRepository implements LoginChallengeRepository {
  private readonly db: Db;

  constructor(client: Db) {
    this.db = client;
  }

  /** Kullanıcının bekleyen eski kodları siliniyor: aynı anda tek geçerli kod. */
  async create({
    id,
    userId,
    codeHash,
    expiresAt
  }: {
    id: string;
    userId: string;
    codeHash: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.db.query("DELETE FROM login_challenges WHERE user_id = $1", [userId]);
    await this.db.query(
      "INSERT INTO login_challenges (id, user_id, code_hash, expires_at) VALUES ($1, $2, $3, $4)",
      [id, userId, codeHash, expiresAt]
    );
  }

  /** FOR UPDATE: iki eş zamanlı deneme sayacı aynı anda okuyup ikisini de geçiremez. */
  async lock(id: string): Promise<LoginChallenge | null> {
    const { rows } = await this.db.query(`SELECT ${ALANLAR} FROM login_challenges WHERE id = $1 FOR UPDATE`, [id]);
    return (rows[0] as LoginChallenge | undefined) ?? null;
  }

  async recordFailure(id: string): Promise<number> {
    const { rows } = await this.db.query(
      "UPDATE login_challenges SET attempts = attempts + 1 WHERE id = $1 RETURNING attempts",
      [id]
    );
    return Number(rows[0]?.attempts ?? 0);
  }

  /** Yeni kod: deneme sayacı sıfırlanıyor, süre baştan başlıyor. */
  async resend({ id, codeHash, expiresAt, now }: { id: string; codeHash: string; expiresAt: Date; now: Date }): Promise<void> {
    await this.db.query(
      `UPDATE login_challenges
       SET code_hash = $2, expires_at = $3, last_sent_at = $4, attempts = 0, sends = sends + 1
       WHERE id = $1`,
      [id, codeHash, expiresAt, now]
    );
  }

  async remove(id: string): Promise<void> {
    await this.db.query("DELETE FROM login_challenges WHERE id = $1", [id]);
  }

  async trustDevice({ userId, tokenHash, expiresAt }: { userId: string; tokenHash: string; expiresAt: Date }): Promise<void> {
    await this.db.query("INSERT INTO trusted_devices (token_hash, user_id, expires_at) VALUES ($1, $2, $3)", [
      tokenHash,
      userId,
      expiresAt
    ]);
  }

  /** Jeton BAŞKA bir kullanıcınınsa geçmez: paylaşılan bilgisayarda hesap değişimi. */
  async isTrustedDevice(userId: string, tokenHash: string, now: Date): Promise<boolean> {
    const { rows } = await this.db.query(
      "SELECT 1 FROM trusted_devices WHERE token_hash = $1 AND user_id = $2 AND expires_at > $3",
      [tokenHash, userId, now]
    );
    return rows.length > 0;
  }

  async revokeTrustedDevices(userId: string): Promise<void> {
    await this.db.query("DELETE FROM trusted_devices WHERE user_id = $1", [userId]);
  }

  async purgeExpired(): Promise<void> {
    await this.db.query("DELETE FROM login_challenges WHERE expires_at < NOW()");
    await this.db.query("DELETE FROM trusted_devices WHERE expires_at < NOW()");
  }
}
