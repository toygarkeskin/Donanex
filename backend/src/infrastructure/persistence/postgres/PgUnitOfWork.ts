"use strict";

import { AsyncLocalStorage } from "node:async_hooks";
import type { Pool, PoolClient } from "pg";

import { PgUserRepository } from "./repositories/PgUserRepository";
import { PgRoleRepository } from "./repositories/PgRoleRepository";
import { PgAuthSessionRepository } from "./repositories/PgAuthSessionRepository";
import { PgOAuthRepository } from "./repositories/PgOAuthRepository";
import { PgVerificationTokenRepository } from "./repositories/PgVerificationTokenRepository";
import { PgStoreRepository } from "./repositories/PgStoreRepository";
import { PgProductRepository } from "./repositories/PgProductRepository";
import { PgCategoryRepository } from "./repositories/PgCategoryRepository";
import { PgCartRepository } from "./repositories/PgCartRepository";
import { PgOrderRepository } from "./repositories/PgOrderRepository";
import { PgSupportRepository } from "./repositories/PgSupportRepository";
import { PgNotificationRepository } from "./repositories/PgNotificationRepository";
import { PgOutboxRepository } from "./repositories/PgOutboxRepository";
import { PgAuditRepository } from "./repositories/PgAuditRepository";

import type { Repositories, UnitOfWork } from "../../../application/shared/contracts";

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
export class PgUnitOfWork implements UnitOfWork {
  private readonly pool: Pool;
  /** Her istek kendi async bağlamında kendi transaction'ını görür. */
  private readonly current = new AsyncLocalStorage<Repositories>();

  constructor(pool: Pool) {
    this.pool = pool;
  }

  buildRepositories(client: PoolClient): Repositories {
    return {
      // Kurulum işlerinin toplu SQL için kullandığı kaçış kapısı.
      db: client,
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
      notifications: new PgNotificationRepository(client),
      outbox: new PgOutboxRepository(client),
      audit: new PgAuditRepository(client)
    };
  }

  async run<T>(work: (repos: Repositories) => Promise<T>): Promise<T> {
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
        const mesaj = rollbackError instanceof Error ? rollbackError.message : String(rollbackError);
        console.error("Geri alma hatası:", mesaj);
      }
      throw error;
    } finally {
      client.release();
    }
  }
}
