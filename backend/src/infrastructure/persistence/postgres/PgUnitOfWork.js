"use strict";

const { AsyncLocalStorage } = require("node:async_hooks");

const { PgUserRepository } = require("./repositories/PgUserRepository");
const { PgRoleRepository } = require("./repositories/PgRoleRepository");
const { PgAuthSessionRepository } = require("./repositories/PgAuthSessionRepository");
const { PgOAuthRepository } = require("./repositories/PgOAuthRepository");
const { PgVerificationTokenRepository } = require("./repositories/PgVerificationTokenRepository");
const { PgStoreRepository } = require("./repositories/PgStoreRepository");
const { PgProductRepository } = require("./repositories/PgProductRepository");
const { PgCategoryRepository } = require("./repositories/PgCategoryRepository");
const { PgCartRepository } = require("./repositories/PgCartRepository");
const { PgOrderRepository } = require("./repositories/PgOrderRepository");
const { PgSupportRepository } = require("./repositories/PgSupportRepository");
const { PgOutboxRepository } = require("./repositories/PgOutboxRepository");
const { PgAuditRepository } = require("./repositories/PgAuditRepository");

/**
 * Yazma tarafının transaction sınırı.
 *
 * Callback'e aynı bağlantıyı paylaşan repository'ler verilir; callback hata
 * fırlatırsa hepsi birlikte geri alınır. Böylece "siparişi yazdım ama stoğu
 * düşemedim" gibi yarım durumlar oluşmaz.
 *
 * İç içe run() çağrıları aynı transaction'ı yeniden kullanır. Açık transaction
 * AsyncLocalStorage'da tutulur — NESNE ÜZERİNDE DEĞİL. Bu ayrım kritiktir:
 * tek bir UnitOfWork örneği tüm istekler tarafından paylaşıldığı için, açık
 * transaction bir alanda (this.active gibi) saklansaydı eş zamanlı iki istek
 * birbirinin transaction'ına yazardı. O durumda stok kontrolü gibi kilide
 * dayanan kurallar sessizce bozulur (iki sipariş aynı son ürünü satabilir).
 */
class PgUnitOfWork {
  constructor(pool) {
    this.pool = pool;
    // Her istek kendi async bağlamında kendi transaction'ını görür.
    this.current = new AsyncLocalStorage();
  }

  buildRepositories(client) {
    return {
      users: new PgUserRepository(client),
      roles: new PgRoleRepository(client),
      authSessions: new PgAuthSessionRepository(client),
      oauth: new PgOAuthRepository(client),
      verificationTokens: new PgVerificationTokenRepository(client),
      stores: new PgStoreRepository(client),
      products: new PgProductRepository(client),
      categories: new PgCategoryRepository(client),
      carts: new PgCartRepository(client),
      orders: new PgOrderRepository(client),
      support: new PgSupportRepository(client),
      outbox: new PgOutboxRepository(client),
      audit: new PgAuditRepository(client)
    };
  }

  async run(work) {
    const active = this.current.getStore();
    if (active) return work(active);

    const client = await this.pool.connect();
    const repos = this.buildRepositories(client);
    try {
      await client.query("BEGIN");
      const result = await this.current.run(repos, () => work(repos));
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
