"use strict";

import type { Db } from "../pool";
import type { OrderRepository, Row } from "../../../../application/shared/contracts";

const ORDER_LOCK = `
  o.id, o.order_number AS "orderNumber", o.status, o.total_cents AS "totalCents",
  o.user_id AS "userId", o.contact_email AS "contactEmail",
  o.contact_full_name AS "contactFullName",
  (o.total_cents::numeric / 100)::text AS total`;

const PACKAGE = `
  id, order_id AS "orderId", store_id AS "storeId", status,
  subtotal_cents AS "subtotalCents", stock_released AS "stockReleased",
  carrier, tracking_number AS "trackingNumber", tracking_url AS "trackingUrl"`;

export class PgOrderRepository implements OrderRepository {
  private readonly db: Db;

  constructor(client: Db) {
    this.db = client;
  }

  /** PZ-2026-001234 biçiminde okunabilir, tahmin edilmesi zor olmayan numara. */
  async nextOrderNumber(): Promise<string> {
    const { rows } = await this.db.query("SELECT nextval('order_number_seq') AS value");
    const year = new Date().getUTCFullYear();
    return `PZ-${year}-${String(rows[0].value).padStart(6, "0")}`;
  }

  async create(order: Row): Promise<Row> {
    const { rows } = await this.db.query(
      `INSERT INTO orders
         (id, order_number, user_id, contact_email, contact_full_name, contact_phone,
          shipping_address, note, total_cents, status, tracking_code_hash, placed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id, order_number AS "orderNumber", status, total_cents AS "totalCents"`,
      [
        order.id,
        order.orderNumber,
        order.userId,
        order.contact.email,
        order.contact.fullName,
        order.contact.phone,
        order.shippingAddress,
        order.note,
        order.total.cents,
        order.status,
        order.trackingCodeHash,
        order.placedAt
      ]
    );
    const saved = rows[0];

    for (const pkg of order.packages) {
      const { rows: packageRows } = await this.db.query(
        `INSERT INTO order_packages (id, order_id, store_id, subtotal_cents, status)
         VALUES (gen_random_uuid(), $1, $2, $3, $4)
         RETURNING id`,
        [saved.id, pkg.storeId, pkg.subtotal.cents, pkg.status]
      );
      for (const item of pkg.items) {
        // Ürün adı, görseli ve fiyatı O ANKİ haliyle kopyalanır: ürün sonradan
        // değişse de geçmiş sipariş bozulmaz.
        await this.db.query(
          `INSERT INTO order_items
             (id, package_id, product_id, product_name, product_image_url, unit_price_cents, quantity)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)`,
          [
            packageRows[0].id,
            item.productId,
            item.productName,
            item.productImageUrl,
            item.unitPrice.cents,
            item.quantity
          ]
        );
      }
    }
    return saved;
  }

  async findById(id: string): Promise<Row | null> {
    const { rows } = await this.db.query(`SELECT ${ORDER_LOCK} FROM orders o WHERE o.id = $1`, [id]);
    return rows[0] || null;
  }

  /** Müşterinin kendi siparişi; başkasınınki bulunamaz muamelesi görür. */
  async lockForUser(orderId: string, userId: string | null): Promise<Row | null> {
    const { rows } = await this.db.query(
      `SELECT ${ORDER_LOCK} FROM orders o WHERE o.id = $1 AND o.user_id = $2 FOR UPDATE`,
      [orderId, userId]
    );
    return rows[0] || null;
  }

  /**
   * Ödeme için sipariş kilidi. Erişim ya sahiplikle ya takip koduyla kanıtlanır;
   * ikisi de yoksa sipariş bulunamaz.
   */
  async lockForPayment({
    orderId,
    userId,
    trackingCodeHash
  }: {
    orderId: string;
    userId?: string | null;
    trackingCodeHash?: string | null;
  }): Promise<Row | null> {
    if (!userId && !trackingCodeHash) return null;
    const { rows } = await this.db.query(
      `SELECT ${ORDER_LOCK} FROM orders o
       WHERE o.id = $1
         AND (($2::uuid IS NOT NULL AND o.user_id = $2::uuid)
              OR ($3::text IS NOT NULL AND o.tracking_code_hash = $3::text))
       FOR UPDATE`,
      [orderId, userId, trackingCodeHash]
    );
    return rows[0] || null;
  }

  /** SKIP LOCKED: birden çok worker aynı siparişi iki kez işlemez. */
  async lockUnpaidOlderThan(cutoff: Date, limit: number): Promise<Row[]> {
    const { rows } = await this.db.query(
      `SELECT ${ORDER_LOCK} FROM orders o
       WHERE o.status = 'pending_payment' AND o.placed_at < $1
       ORDER BY o.placed_at
       LIMIT $2
       FOR UPDATE SKIP LOCKED`,
      [cutoff, limit]
    );
    return rows;
  }

  async listPackages(orderId: string): Promise<Row[]> {
    const { rows } = await this.db.query(
      `SELECT ${PACKAGE} FROM order_packages WHERE order_id = $1 ORDER BY created_at`,
      [orderId]
    );
    return rows;
  }

  async listPackageStatuses(orderId: string): Promise<string[]> {
    const { rows } = await this.db.query("SELECT status FROM order_packages WHERE order_id = $1", [orderId]);
    return rows.map((row) => row.status as string);
  }

  async listPackageItems(packageId: string): Promise<Row[]> {
    const { rows } = await this.db.query(
      `SELECT product_id AS "productId", quantity FROM order_items WHERE package_id = $1 ORDER BY product_id`,
      [packageId]
    );
    return rows;
  }

  async lockPackageForStore(packageId: string, storeId: string): Promise<Row | null> {
    const { rows } = await this.db.query(
      `SELECT ${PACKAGE} FROM order_packages WHERE id = $1 AND store_id = $2 FOR UPDATE`,
      [packageId, storeId]
    );
    return rows[0] || null;
  }

  async setStatus(orderId: string, status: string): Promise<Row | null> {
    const { rows } = await this.db.query(
      `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2
       RETURNING id, order_number AS "orderNumber", status`,
      [status, orderId]
    );
    return rows[0] || null;
  }

  async setPackageStatus(packageId: string, status: string): Promise<Row | null> {
    const { rows } = await this.db.query(
      `UPDATE order_packages SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING ${PACKAGE}`,
      [status, packageId]
    );
    return rows[0] || null;
  }

  /** Stoğun yalnızca BİR KEZ iade edilmesini sağlayan işaret. */
  async markPackageStockReleased(packageId: string): Promise<void> {
    await this.db.query("UPDATE order_packages SET stock_released = TRUE WHERE id = $1", [packageId]);
  }

  async setPackageShipping(packageId: string, storeId: string, shipping: Row): Promise<Row | null> {
    const { rows } = await this.db.query(
      `UPDATE order_packages
       SET carrier = $1, tracking_number = $2, tracking_url = $3, updated_at = NOW()
       WHERE id = $4 AND store_id = $5
       RETURNING ${PACKAGE}`,
      [shipping.carrier, shipping.trackingNumber, shipping.trackingUrl, packageId, storeId]
    );
    return rows[0] || null;
  }

  async recordPayment(payment: Row): Promise<void> {
    await this.db.query(
      `INSERT INTO payments (id, order_id, provider, status, amount_cents, reference, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        payment.id,
        payment.orderId,
        payment.provider,
        payment.status,
        payment.amountCents,
        payment.reference,
        payment.createdAt
      ]
    );
  }
}
