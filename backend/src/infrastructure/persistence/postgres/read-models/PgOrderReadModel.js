"use strict";

const { OrderStatus } = require("../../../../domain/ordering/OrderStatus");

const escapeLike = (text) => text.replace(/[\\%_]/g, (char) => `\\${char}`);

const itemsJson = (unitPriceKey) => `
  COALESCE((
    SELECT json_agg(json_build_object(
      'name', oi.product_name,
      'quantity', oi.quantity,
      '${unitPriceKey}', oi.unit_price
    ) ORDER BY oi.id)
    FROM order_items oi WHERE oi.order_id = o.id
  ), '[]'::json)`;

class PgOrderReadModel {
  constructor(pool) {
    this.db = pool;
  }

  async getPaymentSummary(id, trackingCodeHash) {
    const { rows } = await this.db.query(
      "SELECT id, total, status FROM orders WHERE id = $1 AND tracking_code_hash = $2",
      [id, trackingCodeHash]
    );
    return rows[0] || null;
  }

  async findForTracking(id, trackingCodeHash) {
    const { rows } = await this.db.query(
      `SELECT o.id, o.status, o.created_at, o.total, o.shipping_company, o.tracking_number, o.tracking_url,
              ${itemsJson("unitPrice")} AS items
       FROM orders o
       WHERE o.id = $1 AND o.tracking_code_hash = $2`,
      [id, trackingCodeHash]
    );
    return rows[0] || null;
  }

  async listForCustomer(customerId) {
    const { rows } = await this.db.query(
      `SELECT o.id, o.created_at AS "createdAt", o.status, o.address, o.total,
              o.shipping_company AS "shippingCompany",
              o.tracking_number AS "trackingNumber",
              o.tracking_url AS "trackingUrl",
              ${itemsJson("unitPrice")} AS items
       FROM orders o
       WHERE o.customer_id = $1
       ORDER BY o.created_at DESC
       LIMIT 200`,
      [customerId]
    );
    return rows;
  }

  async listForAdmin({ search, status, from, to, limit, offset }) {
    const where = [];
    const params = [];
    const bind = (value) => {
      params.push(value);
      return `$${params.length}`;
    };

    if (search) {
      const term = bind(`%${escapeLike(search)}%`);
      where.push(`(
        o.id::text ILIKE ${term} OR o.customer_name ILIKE ${term} OR o.email ILIKE ${term}
        OR o.phone ILIKE ${term} OR o.address ILIKE ${term} OR o.status ILIKE ${term}
        OR o.shipping_company ILIKE ${term} OR o.tracking_number ILIKE ${term}
        OR EXISTS (SELECT 1 FROM order_items s WHERE s.order_id = o.id AND s.product_name ILIKE ${term})
      )`);
    }
    if (status) where.push(`o.status = ${bind(status)}`);
    if (from) where.push(`(o.created_at AT TIME ZONE 'Europe/Istanbul')::date >= ${bind(from)}::date`);
    if (to) where.push(`(o.created_at AT TIME ZONE 'Europe/Istanbul')::date <= ${bind(to)}::date`);

    const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const count = await this.db.query(`SELECT COUNT(*)::int AS total FROM orders o ${clause}`, params);
    const { rows } = await this.db.query(
      `SELECT o.id, o.customer_name, o.email, o.phone, o.address, o.total, o.status,
              o.created_at, o.shipping_company, o.tracking_number, o.tracking_url,
              ${itemsJson("unit_price")} AS items
       FROM orders o
       ${clause}
       ORDER BY o.created_at DESC, o.id DESC
       LIMIT ${bind(limit)} OFFSET ${bind(offset)}`,
      params
    );
    return { orders: rows, total: count.rows[0].total };
  }

  async getStats() {
    const { rows } = await this.db.query(
      `SELECT
         (SELECT COUNT(*)::int FROM products WHERE is_active) AS product_count,
         (SELECT COUNT(*)::int FROM products WHERE is_active AND stock <= 3) AS low_stock_count,
         (SELECT COUNT(*)::int FROM orders) AS order_count,
         (SELECT COUNT(*)::int FROM orders WHERE status = $1) AS pending_count,
         (SELECT COUNT(*)::int FROM orders WHERE status = $2) AS test_success_count,
         (SELECT COUNT(*)::int FROM orders WHERE status = $3) AS test_failed_count,
         (SELECT COUNT(*)::int FROM support_requests WHERE status = 'Yeni') AS new_support_count`,
      [OrderStatus.AWAITING_PAYMENT, OrderStatus.TEST_SUCCEEDED, OrderStatus.TEST_FAILED]
    );
    return rows[0];
  }
}

module.exports = { PgOrderReadModel };
