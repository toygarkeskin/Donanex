"use strict";

import type { Db } from "../pool";
import type { Row, UserRepository } from "../../../../application/shared/contracts";

const CREDENTIALS = `
  id, email, full_name AS "fullName", phone, password_hash AS "passwordHash",
  status, email_verified AS "emailVerified", session_version AS "sessionVersion"`;

export class PgUserRepository implements UserRepository {
  private readonly db: Db;

  constructor(client: Db) {
    this.db = client;
  }

  /** E-posta boştaysa kullanıcıyı ekler, doluysa null döner (yarış koşulsuz). */
  async createIfEmailFree({
    id,
    email,
    fullName,
    phone,
    passwordHash
  }: {
    id: string;
    email: string;
    fullName: string;
    phone: string | null;
    passwordHash: string;
  }): Promise<Row | null> {
    const { rows } = await this.db.query(
      `INSERT INTO users (id, email, full_name, phone, password_hash)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (lower(email)) DO NOTHING
       RETURNING id, email, full_name AS "fullName"`,
      [id, email, fullName, phone, passwordHash]
    );
    return rows[0] || null;
  }

  async findCredentialsByEmail(email: string): Promise<Row | null> {
    const { rows } = await this.db.query(`SELECT ${CREDENTIALS} FROM users WHERE lower(email) = lower($1)`, [email]);
    return rows[0] || null;
  }

  async findById(id: string): Promise<Row | null> {
    const { rows } = await this.db.query(`SELECT ${CREDENTIALS} FROM users WHERE id = $1`, [id]);
    return rows[0] || null;
  }

  /** Aynı parolanın daha güçlü özeti; oturumları etkilemez. */
  async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.db.query("UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2", [passwordHash, id]);
  }

  /** Yeni parola: oturum sürümü artar, eski erişim jetonları geçersiz olur. */
  async changePassword(id: string, passwordHash: string): Promise<number | null> {
    const { rows } = await this.db.query(
      `UPDATE users
       SET password_hash = $1, session_version = session_version + 1, updated_at = NOW()
       WHERE id = $2
       RETURNING session_version AS "sessionVersion"`,
      [passwordHash, id]
    );
    await this.db.query("DELETE FROM verification_tokens WHERE purpose = 'password_reset' AND user_id = $1", [id]);
    return rows[0]?.sessionVersion ?? null;
  }

  async updateProfile(id: string, { fullName, phone }: { fullName: string; phone: string | null }): Promise<void> {
    await this.db.query("UPDATE users SET full_name = $1, phone = $2, updated_at = NOW() WHERE id = $3", [
      fullName,
      phone,
      id
    ]);
  }

  async markEmailVerified(id: string): Promise<void> {
    await this.db.query("UPDATE users SET email_verified = TRUE, updated_at = NOW() WHERE id = $1", [id]);
  }

  async setStatus(id: string, status: string): Promise<void> {
    await this.db.query("UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2", [status, id]);
  }

  async touchLastLogin(id: string): Promise<void> {
    await this.db.query("UPDATE users SET last_login_at = NOW() WHERE id = $1", [id]);
  }

  async addAddress(userId: string, address: Row): Promise<Row> {
    const { rows } = await this.db.query(
      `INSERT INTO user_addresses (id, user_id, title, full_name, phone, city, district, line, postal_code)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, title, full_name AS "fullName", phone, city, district, line, postal_code AS "postalCode"`,
      [
        address.id,
        userId,
        address.title,
        address.fullName,
        address.phone,
        address.city,
        address.district,
        address.line,
        address.postalCode
      ]
    );
    return rows[0];
  }

  async updateAddress(userId: string, addressId: string, address: Row): Promise<Row | null> {
    const { rows } = await this.db.query(
      `UPDATE user_addresses
       SET title = $1, full_name = $2, phone = $3, city = $4, district = $5, line = $6, postal_code = $7
       WHERE id = $8 AND user_id = $9
       RETURNING id, title, full_name AS "fullName", phone, city, district, line, postal_code AS "postalCode"`,
      [
        address.title,
        address.fullName,
        address.phone,
        address.city,
        address.district,
        address.line,
        address.postalCode,
        addressId,
        userId
      ]
    );
    return rows[0] || null;
  }

  async removeAddress(userId: string, addressId: string): Promise<boolean> {
    const result = await this.db.query("DELETE FROM user_addresses WHERE id = $1 AND user_id = $2", [
      addressId,
      userId
    ]);
    return (result.rowCount ?? 0) > 0;
  }
}
