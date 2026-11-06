"use strict";

import type { Pool } from "pg";
import { money } from "./sql";
import type { DashboardReadModel, Row } from "../../../../application/shared/contracts";

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
         COALESCE((
           SELECT json_agg(day ORDER BY day->>'date')
           FROM (
             SELECT json_build_object(
               'date', to_char(d.day, 'YYYY-MM-DD'),
               'orders', COUNT(o.id)::int,
               'revenueCents', COALESCE(SUM(o.total_cents) FILTER (WHERE o.status IN ('paid','completed')), 0)::bigint
             ) AS day
             FROM generate_series(CURRENT_DATE - INTERVAL '13 days', CURRENT_DATE, INTERVAL '1 day') AS d(day)
             LEFT JOIN orders o ON (o.placed_at AT TIME ZONE 'Europe/Istanbul')::date = d.day::date
             GROUP BY d.day
           ) series
         ), '[]'::json) AS "last14Days"`
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
                     AND op.status NOT IN ('cancelled','refunded'))`)} AS "revenue"`,
      [storeId]
    );
    return rows[0];
  }
}
