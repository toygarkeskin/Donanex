"use strict";

class PgHealthReadModel {
  constructor(pool) {
    this.db = pool;
  }

  async ping() {
    await this.db.query("SELECT 1");
  }
}

module.exports = { PgHealthReadModel };
