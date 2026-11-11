"use strict";

import type { Pool } from "pg";
import { paginate } from "./sql";
import type {
  ListFilters,
  NotificationReadModel,
  NotificationTarget,
  Row
} from "../../../../application/shared/contracts";

const BILDIRIM = `
  n.id, n.kind, n.title, n.body, n.url,
  n.read_at AS "readAt", n.created_at AS "createdAt"`;

/*
 * Alıcı koşulu tek yerde.
 *
 * "=" yerine IS NOT DISTINCT FROM: yönetim bildirimlerinde scope_id NULL ve
 * SQL'de "NULL = NULL" doğru değil BİLİNMEYEN'dir — eşitlikle yazılsa yönetim
 * paneli kendi bildirimlerini hiç göremezdi.
 */
const ALICI = `n.scope = $1 AND n.scope_id IS NOT DISTINCT FROM $2::uuid`;

export class PgNotificationReadModel implements NotificationReadModel {
  private readonly db: Pool;

  constructor(pool: Pool) {
    this.db = pool;
  }

  /**
   * Bildirim listesi.
   *
   * Okunmamışlar üste ÇIKARILMIYOR, sıralama katı biçimde zaman. Deneme
   * sırasında okunmamışları öne almak kafa karıştırıcı çıktı: kullanıcı bir
   * bildirimi okuyunca satır gözünün önünde aşağıya atlıyordu.
   *
   * Okunmamış sayısı listeyle BİRLİKTE dönüyor (ayrı istek değil): zil hem
   * sayıyı hem listeyi aynı anda gösteriyor, iki istek atmak bir ekranda iki
   * farklı anın verisini yan yana koymak olurdu.
   */
  async list(target: NotificationTarget, paging: ListFilters): Promise<Row> {
    const params = [target.scope, target.scopeId];

    const sayim = await this.db.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE n.read_at IS NULL)::int AS unread
         FROM notifications n WHERE ${ALICI}`,
      params
    );
    const { rows } = await this.db.query(
      `SELECT ${BILDIRIM} FROM notifications n
        WHERE ${ALICI}
        ORDER BY n.created_at DESC, n.id
        LIMIT $3 OFFSET $4`,
      [...params, paging.limit, paging.offset]
    );

    return { ...paginate(rows, sayim.rows[0].total, paging), unread: sayim.rows[0].unread };
  }

  async countUnread(target: NotificationTarget): Promise<number> {
    const { rows } = await this.db.query(
      `SELECT COUNT(*)::int AS unread FROM notifications n WHERE ${ALICI} AND n.read_at IS NULL`,
      [target.scope, target.scopeId]
    );
    return rows[0].unread;
  }
}
