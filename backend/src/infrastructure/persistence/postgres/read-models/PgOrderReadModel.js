"use strict";

const { escapeLike, money, binder, paginate } = require("./sql");

/** Bir paketin ürün satırları — alt sorgu olarak JSON üretir. */
const ITEMS = `
  COALESCE((
    SELECT json_agg(json_build_object(
      'productId', oi.product_id,
      'name', oi.product_name,
      'imageUrl', oi.product_image_url,
      'quantity', oi.quantity,
      'unitPrice', ${money("oi.unit_price_cents")},
      'lineTotal', ${money("oi.unit_price_cents * oi.quantity")}
    ) ORDER BY oi.product_name)
    FROM order_items oi WHERE oi.package_id = op.id
  ), '[]'::json)`;

/** Siparişin mağaza bazlı paketleri. */
const PACKAGES = `
  COALESCE((
    SELECT json_agg(json_build_object(
      'id', op.id,
      'storeId', op.store_id,
      'storeName', st.name,
      'storeSlug', st.slug,
      'status', op.status,
      'subtotal', ${money("op.subtotal_cents")},
      'carrier', op.carrier,
      'trackingNumber', op.tracking_number,
      'trackingUrl', op.tracking_url,
      'items', ${ITEMS}
    ) ORDER BY st.name)
    FROM order_packages op
    JOIN stores st ON st.id = op.store_id
    WHERE op.order_id = o.id
  ), '[]'::json)`;

const SUMMARY = `
  o.id, o.order_number AS "orderNumber", o.status, o.placed_at AS "placedAt",
  ${money("o.total_cents")} AS total`;

class PgOrderReadModel {
  constructor(pool) {
    this.db = pool;
  }

  async listForUser(userId, paging) {
    const count = await this.db.query("SELECT COUNT(*)::int AS total FROM orders WHERE user_id = $1", [userId]);
    const { rows } = await this.db.query(
      `SELECT ${SUMMARY}, ${PACKAGES} AS packages
       FROM orders o
       WHERE o.user_id = $1
       ORDER BY o.placed_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, paging.limit, paging.offset]
    );
    return paginate(rows, count.rows[0].total, paging);
  }

  /** Kullanıcı kimliği sorgunun parçası: başkasının siparişi dönmez. */
  async getForUser(orderId, userId) {
    const { rows } = await this.db.query(
      `SELECT ${SUMMARY}, o.shipping_address AS "shippingAddress", o.note,
              o.contact_email AS "contactEmail", o.contact_full_name AS "contactFullName",
              o.contact_phone AS "contactPhone", ${PACKAGES} AS packages
       FROM orders o
       WHERE o.id = $1 AND o.user_id = $2`,
      [orderId, userId]
    );
    return rows[0] || null;
  }

  /**
   * Misafir takibi. Yanıt kişisel veri İÇERMEZ: adres, telefon ve e-posta
   * dönmez; yalnızca durum, tutar ve kargo bilgisi verilir.
   */
  async getByTrackingCode(orderNumber, trackingCodeHash) {
    const { rows } = await this.db.query(
      `SELECT ${SUMMARY}, ${PACKAGES} AS packages
       FROM orders o
       WHERE o.order_number = $1 AND o.tracking_code_hash = $2`,
      [orderNumber, trackingCodeHash]
    );
    return rows[0] || null;
  }

  /** Mağaza paneli: yalnızca o mağazanın paketleri ve kendi ürün satırları. */
  async listForStore(storeId, filters) {
    const { params, bind } = binder([storeId]);
    const where = ["op.store_id = $1"];

    if (filters.search) {
      const term = bind(`%${escapeLike(filters.search)}%`);
      where.push(`(o.order_number ILIKE ${term} OR o.contact_full_name ILIKE ${term}
                   OR EXISTS (SELECT 1 FROM order_items oi WHERE oi.package_id = op.id AND oi.product_name ILIKE ${term}))`);
    }
    if (filters.status) where.push(`op.status = ${bind(filters.status)}`);
    if (filters.from) where.push(`(o.placed_at AT TIME ZONE 'Europe/Istanbul')::date >= ${bind(filters.from)}::date`);
    if (filters.to) where.push(`(o.placed_at AT TIME ZONE 'Europe/Istanbul')::date <= ${bind(filters.to)}::date`);

    const from = `FROM order_packages op JOIN orders o ON o.id = op.order_id WHERE ${where.join(" AND ")}`;
    const count = await this.db.query(`SELECT COUNT(*)::int AS total ${from}`, params);
    const { rows } = await this.db.query(
      `SELECT op.id AS "packageId", op.status, ${money("op.subtotal_cents")} AS subtotal,
              op.carrier, op.tracking_number AS "trackingNumber",
              o.id AS "orderId", o.order_number AS "orderNumber", o.placed_at AS "placedAt",
              o.status AS "orderStatus", o.contact_full_name AS "customerName",
              ${ITEMS} AS items
       ${from}
       ORDER BY o.placed_at DESC
       LIMIT ${bind(filters.limit)} OFFSET ${bind(filters.offset)}`,
      params
    );
    return paginate(rows, count.rows[0].total, filters);
  }

  /** Paket detayı. Mağaza, müşterinin teslimat bilgisini görür (kargo için gerekli). */
  async getForStore(packageId, storeId) {
    const { rows } = await this.db.query(
      `SELECT op.id AS "packageId", op.status, ${money("op.subtotal_cents")} AS subtotal,
              op.carrier, op.tracking_number AS "trackingNumber", op.tracking_url AS "trackingUrl",
              o.id AS "orderId", o.order_number AS "orderNumber", o.placed_at AS "placedAt",
              o.status AS "orderStatus", o.note,
              o.contact_full_name AS "customerName", o.contact_phone AS "customerPhone",
              o.shipping_address AS "shippingAddress",
              ${ITEMS} AS items
       FROM order_packages op
       JOIN orders o ON o.id = op.order_id
       WHERE op.id = $1 AND op.store_id = $2`,
      [packageId, storeId]
    );
    return rows[0] || null;
  }

  async listForAdmin(filters) {
    const { params, bind } = binder();
    const where = [];

    if (filters.search) {
      const term = bind(`%${escapeLike(filters.search)}%`);
      where.push(`(o.order_number ILIKE ${term} OR o.contact_full_name ILIKE ${term}
                   OR o.contact_email ILIKE ${term} OR o.contact_phone ILIKE ${term})`);
    }
    if (filters.status) where.push(`o.status = ${bind(filters.status)}`);
    if (filters.from) where.push(`(o.placed_at AT TIME ZONE 'Europe/Istanbul')::date >= ${bind(filters.from)}::date`);
    if (filters.to) where.push(`(o.placed_at AT TIME ZONE 'Europe/Istanbul')::date <= ${bind(filters.to)}::date`);

    const from = `FROM orders o ${where.length ? `WHERE ${where.join(" AND ")}` : ""}`;
    const count = await this.db.query(`SELECT COUNT(*)::int AS total ${from}`, params);
    const { rows } = await this.db.query(
      `SELECT ${SUMMARY}, o.contact_full_name AS "customerName", o.contact_email AS "customerEmail",
              o.user_id AS "userId", ${PACKAGES} AS packages
       ${from}
       ORDER BY o.placed_at DESC
       LIMIT ${bind(filters.limit)} OFFSET ${bind(filters.offset)}`,
      params
    );
    return paginate(rows, count.rows[0].total, filters);
  }

  async getForAdmin(orderId) {
    const { rows } = await this.db.query(
      `SELECT ${SUMMARY}, o.shipping_address AS "shippingAddress", o.note,
              o.contact_email AS "contactEmail", o.contact_full_name AS "contactFullName",
              o.contact_phone AS "contactPhone", o.user_id AS "userId",
              ${PACKAGES} AS packages,
              COALESCE((
                SELECT json_agg(json_build_object(
                  'provider', pay.provider, 'status', pay.status,
                  'reference', pay.reference, 'createdAt', pay.created_at,
                  'amount', ${money("pay.amount_cents")}
                ) ORDER BY pay.created_at)
                FROM payments pay WHERE pay.order_id = o.id
              ), '[]'::json) AS payments
       FROM orders o WHERE o.id = $1`,
      [orderId]
    );
    return rows[0] || null;
  }
}

module.exports = { PgOrderReadModel };
