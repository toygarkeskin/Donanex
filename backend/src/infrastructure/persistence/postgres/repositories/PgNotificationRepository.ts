"use strict";

import type { Db } from "../pool";
import type {
  NewNotification,
  NotificationRepository,
  NotificationTarget,
  Row
} from "../../../../application/shared/contracts";

const BILDIRIM = `
  id, scope, scope_id AS "scopeId", kind, title, body, url,
  read_at AS "readAt", created_at AS "createdAt"`;

export class PgNotificationRepository implements NotificationRepository {
  private readonly db: Db;

  constructor(client: Db) {
    this.db = client;
  }

  /**
   * Bir olaydan doğan bildirimleri TEK sorguda yazar.
   *
   * ON CONFLICT DO NOTHING + RETURNING birlikte çalışıyor: aynı olay ikinci
   * kez geldiğinde çakışan satırlar yazılmaz ve RETURNING da onları
   * döndürmez. Böylece "kaç tanesi gerçekten yeni" sorusunun cevabı ayrı bir
   * SELECT gerektirmiyor — çağıran gerçek zamanlı bildirimi yalnızca yeni
   * satırlar için yayınlıyor.
   */
  async addMany({
    sourceEventId = null,
    items
  }: {
    sourceEventId?: string | null;
    items: readonly NewNotification[];
  }): Promise<Row[]> {
    if (!items.length) return [];

    const values: string[] = [];
    const params: unknown[] = [];
    // Kolon sayısı tek yerde: liste ile yer tutucu sayısı ayrı ayrı
    // güncellenirse parametreler sessizce kayar.
    const SUTUN_SAYISI = 8;
    items.forEach((item, index) => {
      const offset = index * SUTUN_SAYISI;
      values.push(`(${Array.from({ length: SUTUN_SAYISI }, (_, i) => `$${offset + i + 1}`).join(", ")})`);
      params.push(
        item.id,
        item.scope,
        item.scopeId,
        item.kind,
        item.title,
        item.body ?? "",
        item.url ?? null,
        sourceEventId
      );
    });

    const { rows } = await this.db.query(
      `INSERT INTO notifications (id, scope, scope_id, kind, title, body, url, source_event_id)
       VALUES ${values.join(", ")}
       ON CONFLICT DO NOTHING
       RETURNING ${BILDIRIM}`,
      params
    );
    return rows;
  }

  /**
   * Okundu işaretler.
   *
   * Alıcı WHERE'in içinde: başka bir kullanıcının bildirim numarasını
   * deneyerek onun bildirimine dokunmak mümkün değil, ve "bulunamadı" ile
   * "senin değil" aynı yanıtı veriyor (false).
   *
   * read_at IS NULL koşulu yok: aynı bildirimi iki kez okundu işaretlemek
   * zararsız olmalı, hata değil.
   */
  async markRead({ scope, scopeId }: NotificationTarget, notificationId: string): Promise<boolean> {
    const { rowCount } = await this.db.query(
      `UPDATE notifications SET read_at = COALESCE(read_at, NOW())
       WHERE id = $1 AND scope = $2 AND scope_id IS NOT DISTINCT FROM $3::uuid`,
      [notificationId, scope, scopeId]
    );
    return (rowCount ?? 0) > 0;
  }

  /**
   * "Tümünü okundu işaretle".
   *
   * IS NOT DISTINCT FROM kullanılıyor, "=" değil: yönetim bildirimlerinde
   * scope_id NULL ve "NULL = NULL" SQL'de doğru değil BİLİNMEYEN'dir, yani
   * eşitlikle yazılsa yönetim bildirimleri hiç güncellenmezdi.
   */
  async markAllRead({ scope, scopeId }: NotificationTarget): Promise<number> {
    const { rowCount } = await this.db.query(
      `UPDATE notifications SET read_at = NOW()
       WHERE scope = $1 AND scope_id IS NOT DISTINCT FROM $2::uuid AND read_at IS NULL`,
      [scope, scopeId]
    );
    return rowCount ?? 0;
  }
}
