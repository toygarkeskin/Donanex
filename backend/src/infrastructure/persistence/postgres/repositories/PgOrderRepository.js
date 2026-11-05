"use strict";

const { OrderStatus } = require("../../../../domain/ordering/OrderStatus");

const LOCK_COLUMNS = `id, status, total, customer_id AS "customerId", stock_restored AS "stockRestored"`;

class PgOrderRepository {
  constructor(client) {
    this.db = client;
  }

  /** Siparişi ve satırlarını kaydeder. */
  async add(order, trackingCodeHash) {
    const { rows } = await this.db.query(
      `INSERT INTO orders
         (customer_id, customer_name, email, phone, address, total, status, tracking_code_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, total, status`,
      [
        order.customerId,
        order.recipient.name,
        order.recipient.email,
        order.recipient.phone,
        order.recipient.address,
        order.total,
        order.status,
        trackingCodeHash
      ]
    );
    const saved = rows[0];

    for (const line of order.lines) {
      await this.db.query(
        `INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price)
         VALUES ($1, $2, $3, $4, $5)`,
        [saved.id, line.productId, line.productName, line.quantity, line.unitPrice]
      );
    }
    return saved;
  }

  async lockById(id) {
    const { rows } = await this.db.query(`SELECT ${LOCK_COLUMNS} FROM orders WHERE id = $1 FOR UPDATE`, [id]);
    return rows[0] || null;
  }

  async lockByIdAndTrackingHash(id, trackingCodeHash) {
    const { rows } = await this.db.query(
      `SELECT ${LOCK_COLUMNS} FROM orders WHERE id = $1 AND tracking_code_hash = $2 FOR UPDATE`,
      [id, trackingCodeHash]
    );
    return rows[0] || null;
  }

  /** Birden çok sunucu çalışsa bile aynı sipariş iki kez işlenmez (SKIP LOCKED). */
  async lockUnpaidOlderThan(cutoff, limit) {
    const { rows } = await this.db.query(
      `SELECT ${LOCK_COLUMNS} FROM orders
       WHERE status = $1 AND created_at < $2
       ORDER BY created_at LIMIT $3 FOR UPDATE SKIP LOCKED`,
      [OrderStatus.AWAITING_PAYMENT, cutoff, limit]
    );
    return rows;
  }

  async findLines(orderId) {
    const { rows } = await this.db.query(
      `SELECT product_id AS "productId", quantity
       FROM order_items WHERE order_id = $1 ORDER BY product_id`,
      [orderId]
    );
    return rows;
  }

  async setStatus(id, status) {
    const { rows } = await this.db.query(
      "UPDATE orders SET status = $1 WHERE id = $2 RETURNING id, status, total",
      [status, id]
    );
    return rows[0] || null;
  }

  async markStockRestored(id) {
    await this.db.query("UPDATE orders SET stock_restored = TRUE WHERE id = $1", [id]);
  }

  async setShipping(id, shipping) {
    const { rows } = await this.db.query(
      `UPDATE orders
       SET shipping_company = $1, tracking_number = $2, tracking_url = $3
       WHERE id = $4
       RETURNING id, shipping_company, tracking_number, tracking_url`,
      [shipping.company, shipping.trackingNumber, shipping.trackingUrl, id]
    );
    return rows[0] || null;
  }
}

module.exports = { PgOrderRepository };
