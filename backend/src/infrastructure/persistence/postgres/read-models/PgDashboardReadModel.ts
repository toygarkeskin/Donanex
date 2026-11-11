"use strict";

import type { Pool } from "pg";
import { money } from "./sql";
import type { DashboardReadModel, Row } from "../../../../application/shared/contracts";

/**
 * Son on dört günün günlük serisi.
 *
 * generate_series ile ÖNCE günler üretiliyor, sonra veri sola ekleniyor:
 * sipariş alınmayan gün de seride yer alıyor. Yalnızca var olan satırları
 * gruplasaydık boş günler listeden düşer ve grafik takvim boyunca değil
 * "sipariş olan günler" boyunca uzardı — iki sakin hafta, yoğun bir hafta
 * gibi görünürdü.
 *
 * Gün sınırı Europe/Istanbul'a göre: sunucu UTC çalışıyor ve saat 02:00'de
 * verilen bir sipariş UTC'de önceki güne düşerdi.
 *
 * @param kaynak  günlük satırları veren FROM/JOIN parçası (d.day ile eşleşir)
 * @param adet    o gün kaç kayıt
 * @param tutar   o günün kuruş cinsinden cirosu
 */
const gunlukSeri = (kaynak: string, adet: string, tutar: string): string => `
  COALESCE((
    SELECT json_agg(gun ORDER BY gun->>'date')
    FROM (
      SELECT json_build_object(
        'date', to_char(d.day, 'YYYY-MM-DD'),
        'orders', ${adet},
        'revenueCents', COALESCE(${tutar}, 0)::bigint
      ) AS gun
      FROM generate_series(CURRENT_DATE - INTERVAL '13 days', CURRENT_DATE, INTERVAL '1 day') AS d(day)
      ${kaynak}
      GROUP BY d.day
    ) seri
  ), '[]'::json)`;

export class PgDashboardReadModel implements DashboardReadModel {
  private readonly db: Pool;

  constructor(pool: Pool) {
    this.db = pool;
  }

  /** Sistem yöneticisi özeti. */
  async adminSummary(): Promise<Row> {
    const { rows } = await this.db.query(
      `SELECT
         (SELECT COUNT(*)::int FROM users WHERE status = 'active')            AS "activeUsers",
         (SELECT COUNT(*)::int FROM stores WHERE status = 'active')           AS "activeStores",
         (SELECT COUNT(*)::int FROM stores WHERE status = 'pending')          AS "pendingStores",
         (SELECT COUNT(*)::int FROM products WHERE status = 'active')         AS "activeProducts",
         (SELECT COUNT(*)::int FROM orders)                                   AS "totalOrders",
         (SELECT COUNT(*)::int FROM orders WHERE status = 'pending_payment')  AS "pendingPayment",
         (SELECT COUNT(*)::int FROM support_tickets WHERE status = 'open')    AS "openTickets",
         ${money("(SELECT COALESCE(SUM(total_cents), 0) FROM orders WHERE status IN ('paid','completed'))")} AS "paidVolume",
         ${gunlukSeri(
           "LEFT JOIN orders o ON (o.placed_at AT TIME ZONE 'Europe/Istanbul')::date = d.day::date",
           "COUNT(o.id)::int",
           "SUM(o.total_cents) FILTER (WHERE o.status IN ('paid','completed'))"
         )} AS "last14Days"`
    );
    return rows[0];
  }

  /** Mağaza özeti — yalnızca o mağazanın sayıları. */
  async storeSummary(storeId: string): Promise<Row> {
    const { rows } = await this.db.query(
      `SELECT
         (SELECT COUNT(*)::int FROM products WHERE store_id = $1 AND status = 'active')   AS "activeProducts",
         (SELECT COUNT(*)::int FROM products WHERE store_id = $1 AND status = 'draft')    AS "draftProducts",
         (SELECT COUNT(*)::int FROM products WHERE store_id = $1 AND status = 'active' AND stock <= 3) AS "lowStock",
         (SELECT COUNT(*)::int FROM order_packages WHERE store_id = $1)                   AS "totalPackages",
         (SELECT COUNT(*)::int FROM order_packages WHERE store_id = $1 AND status = 'pending')   AS "pendingPackages",
         (SELECT COUNT(*)::int FROM order_packages WHERE store_id = $1 AND status = 'preparing') AS "preparingPackages",
         (SELECT COUNT(*)::int FROM support_tickets WHERE store_id = $1 AND status = 'open')     AS "openTickets",
         ${money(`(SELECT COALESCE(SUM(op.subtotal_cents), 0)
                   FROM order_packages op JOIN orders o ON o.id = op.order_id
                   WHERE op.store_id = $1 AND o.status IN ('paid','completed')
                     AND op.status NOT IN ('cancelled','refunded'))`)} AS "revenue",
         /*
          * Mağazanın serisi PAKET üzerinden sayılıyor, sipariş üzerinden
          * değil: bir sipariş birden çok mağazaya bölünebiliyor ve mağazanın
          * panelinde görünen birim kendi paketi. Mağaza filtresi JOIN'in
          * içinde (WHERE'de değil): WHERE'e konsaydı eşleşmeyen günlerin
          * NULL satırları elenir ve sakin günler seriden düşerdi.
          */
         ${gunlukSeri(
           `LEFT JOIN order_packages op
                   ON op.store_id = $1
                  AND (op.created_at AT TIME ZONE 'Europe/Istanbul')::date = d.day::date
            LEFT JOIN orders o ON o.id = op.order_id`,
           "COUNT(op.id)::int",
           `SUM(op.subtotal_cents) FILTER (
              WHERE o.status IN ('paid','completed') AND op.status NOT IN ('cancelled','refunded')
            )`
         )} AS "last14Days"`,
      [storeId]
    );
    return rows[0];
  }
}
