"use strict";

const { PgProductRepository } = require("./repositories/PgProductRepository");
const { PgOrderRepository } = require("./repositories/PgOrderRepository");
const { PgCustomerRepository } = require("./repositories/PgCustomerRepository");
const { PgSupportRepository } = require("./repositories/PgSupportRepository");
const { PgSessionRepository } = require("./repositories/PgSessionRepository");

/**
 * Yazma tarafının transaction sınırı.
 * Callback'e aynı bağlantıyı paylaşan repository'ler verilir;
 * callback hata fırlatırsa her şey geri alınır.
 */
class PgUnitOfWork {
  constructor(pool) {
    this.pool = pool;
  }

  async run(work) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await work({
        products: new PgProductRepository(client),
        orders: new PgOrderRepository(client),
        customers: new PgCustomerRepository(client),
        support: new PgSupportRepository(client),
        sessions: new PgSessionRepository(client)
      });
      await client.query("COMMIT");
      return result;
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Geri alma hatası:", rollbackError.message);
      }
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = { PgUnitOfWork };
