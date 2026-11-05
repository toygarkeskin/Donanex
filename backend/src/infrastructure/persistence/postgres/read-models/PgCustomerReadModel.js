"use strict";

class PgCustomerReadModel {
  constructor(pool) {
    this.db = pool;
  }

  async getProfile(customerId) {
    const { rows } = await this.db.query("SELECT id, name, email FROM customers WHERE id = $1", [customerId]);
    return rows[0] || null;
  }

  async getAddress(customerId) {
    const { rows } = await this.db.query(
      `SELECT
         COALESCE(address_full_name, '') AS "fullName",
         COALESCE(phone, '') AS phone,
         COALESCE(address, '') AS address
       FROM customers WHERE id = $1`,
      [customerId]
    );
    return rows[0] || null;
  }

  async getSessionVersion(customerId) {
    const { rows } = await this.db.query("SELECT session_version AS v FROM customers WHERE id = $1", [customerId]);
    return rows[0]?.v ?? null;
  }
}

module.exports = { PgCustomerReadModel };
