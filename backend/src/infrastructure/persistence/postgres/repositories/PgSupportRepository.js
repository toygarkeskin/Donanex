"use strict";

class PgSupportRepository {
  constructor(client) {
    this.db = client;
  }

  async add({ fullName, email, phone, message }) {
    const { rows } = await this.db.query(
      `INSERT INTO support_requests (full_name, email, phone, message)
       VALUES ($1, $2, $3, $4)
       RETURNING id, created_at`,
      [fullName, email, phone, message]
    );
    return rows[0];
  }

  async findContact(id) {
    const { rows } = await this.db.query(
      `SELECT full_name AS "fullName", email, admin_response AS "adminResponse"
       FROM support_requests WHERE id = $1 FOR UPDATE`,
      [id]
    );
    return rows[0] || null;
  }

  async respond(id, status, response) {
    const { rows } = await this.db.query(
      `UPDATE support_requests
       SET status = $1, admin_response = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING id, status, admin_response, updated_at`,
      [status, response, id]
    );
    return rows[0] || null;
  }

  async remove(id) {
    const result = await this.db.query("DELETE FROM support_requests WHERE id = $1", [id]);
    return result.rowCount > 0;
  }
}

module.exports = { PgSupportRepository };
