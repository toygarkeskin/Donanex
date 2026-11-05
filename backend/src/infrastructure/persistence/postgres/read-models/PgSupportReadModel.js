"use strict";

const COLUMNS = "id, full_name, email, phone, message, status, admin_response, created_at, updated_at";

class PgSupportReadModel {
  constructor(pool) {
    this.db = pool;
  }

  async list(limit = 500) {
    const { rows } = await this.db.query(
      `SELECT ${COLUMNS} FROM support_requests ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );
    return rows;
  }

  async get(id) {
    const { rows } = await this.db.query(`SELECT ${COLUMNS} FROM support_requests WHERE id = $1`, [id]);
    return rows[0] || null;
  }
}

module.exports = { PgSupportReadModel };
