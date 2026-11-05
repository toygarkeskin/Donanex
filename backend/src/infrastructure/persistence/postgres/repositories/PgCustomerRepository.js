"use strict";

const CREDENTIALS = `id, name, email, password_hash AS "passwordHash", session_version AS "sessionVersion"`;

class PgCustomerRepository {
  constructor(client) {
    this.db = client;
  }

  /** E-posta boştaysa müşteriyi ekler; doluysa null döner. */
  async addIfEmailFree({ name, email, passwordHash }) {
    const { rows } = await this.db.query(
      `INSERT INTO customers (name, email, password_hash)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO NOTHING
       RETURNING id, name, email`,
      [name, email, passwordHash]
    );
    return rows[0] || null;
  }

  async findCredentialsByEmail(email) {
    const { rows } = await this.db.query(`SELECT ${CREDENTIALS} FROM customers WHERE email = $1`, [email]);
    return rows[0] || null;
  }

  async findCredentialsById(id) {
    const { rows } = await this.db.query(`SELECT ${CREDENTIALS} FROM customers WHERE id = $1`, [id]);
    return rows[0] || null;
  }

  async saveAddress(customerId, address) {
    await this.db.query(
      `UPDATE customers
       SET address_full_name = $1, phone = $2, address = $3
       WHERE id = $4`,
      [address.fullName, address.phone, address.address, customerId]
    );
  }

  async updateName(customerId, name) {
    await this.db.query("UPDATE customers SET name = $1 WHERE id = $2", [name, customerId]);
  }

  /** Aynı parolanın daha güçlü özeti; oturumları etkilemez. */
  async upgradePasswordHash(customerId, passwordHash) {
    await this.db.query("UPDATE customers SET password_hash = $1 WHERE id = $2", [passwordHash, customerId]);
  }

  /** Yeni parola: oturum sürümü artar, eski belirteçler geçersiz olur. Yeni sürümü döndürür. */
  async changePassword(customerId, passwordHash) {
    const { rows } = await this.db.query(
      `UPDATE customers
       SET password_hash = $1, session_version = session_version + 1
       WHERE id = $2
       RETURNING session_version AS "sessionVersion"`,
      [passwordHash, customerId]
    );
    await this.db.query("DELETE FROM password_reset_tokens WHERE customer_id = $1", [customerId]);
    return rows[0]?.sessionVersion ?? null;
  }

  /** Müşterinin önceki sıfırlama bağlantıları geçersiz olur. */
  async replaceResetToken(customerId, tokenHash, expiresAt) {
    await this.db.query("DELETE FROM password_reset_tokens WHERE customer_id = $1 OR expires_at < NOW()", [customerId]);
    await this.db.query(
      "INSERT INTO password_reset_tokens (token_hash, customer_id, expires_at) VALUES ($1, $2, $3)",
      [tokenHash, customerId, expiresAt]
    );
  }

  /** Geçerli belirteci atomik olarak tüketir; aynı bağlantı ikinci kez kullanılamaz. */
  async consumeResetToken(tokenHash) {
    const { rows } = await this.db.query(
      `DELETE FROM password_reset_tokens
       WHERE token_hash = $1 AND expires_at > NOW()
       RETURNING customer_id AS "customerId"`,
      [tokenHash]
    );
    return rows[0]?.customerId ?? null;
  }
}

module.exports = { PgCustomerRepository };
