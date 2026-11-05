"use strict";

const { binder, paginate } = require("./sql");

const SUMMARY = `
  t.id, t.reference, t.subject, t.status, t.created_at AS "createdAt",
  t.full_name AS "fullName", t.email, t.store_id AS "storeId"`;

const MESSAGES = `
  COALESCE((
    SELECT json_agg(json_build_object(
      'id', m.id, 'body', m.body, 'isStaff', m.is_staff, 'createdAt', m.created_at
    ) ORDER BY m.created_at)
    FROM support_messages m WHERE m.ticket_id = t.id
  ), '[]'::json)`;

class PgSupportReadModel {
  constructor(pool) {
    this.db = pool;
  }

  async listForUser(userId, paging) {
    const count = await this.db.query(
      "SELECT COUNT(*)::int AS total FROM support_tickets WHERE user_id = $1",
      [userId]
    );
    const { rows } = await this.db.query(
      `SELECT ${SUMMARY} FROM support_tickets t
       WHERE t.user_id = $1 ORDER BY t.created_at DESC LIMIT $2 OFFSET $3`,
      [userId, paging.limit, paging.offset]
    );
    return paginate(rows, count.rows[0].total, paging);
  }

  async listForStore(storeId, filters) {
    const { params, bind } = binder([storeId]);
    const where = ["t.store_id = $1"];
    if (filters.status) where.push(`t.status = ${bind(filters.status)}`);

    const from = `FROM support_tickets t WHERE ${where.join(" AND ")}`;
    const count = await this.db.query(`SELECT COUNT(*)::int AS total ${from}`, params);
    const { rows } = await this.db.query(
      `SELECT ${SUMMARY} ${from} ORDER BY t.created_at DESC LIMIT ${bind(filters.limit)} OFFSET ${bind(filters.offset)}`,
      params
    );
    return paginate(rows, count.rows[0].total, filters);
  }

  async listForAdmin(filters) {
    const { params, bind } = binder();
    const where = [];
    if (filters.status) where.push(`t.status = ${bind(filters.status)}`);

    const from = `FROM support_tickets t LEFT JOIN stores s ON s.id = t.store_id ${where.length ? `WHERE ${where.join(" AND ")}` : ""}`;
    const count = await this.db.query(`SELECT COUNT(*)::int AS total ${from}`, params);
    const { rows } = await this.db.query(
      `SELECT ${SUMMARY}, s.name AS "storeName" ${from}
       ORDER BY CASE t.status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END, t.created_at DESC
       LIMIT ${bind(filters.limit)} OFFSET ${bind(filters.offset)}`,
      params
    );
    return paginate(rows, count.rows[0].total, filters);
  }

  /** Kapsam filtresi sorgunun içindedir: başkasının talebi dönmez. */
  async get(ticketId, { userId = null, storeId = null } = {}) {
    const { rows } = await this.db.query(
      `SELECT ${SUMMARY}, t.message, t.order_id AS "orderId", ${MESSAGES} AS messages
       FROM support_tickets t
       WHERE t.id = $1
         AND ($2::uuid IS NULL OR t.user_id = $2::uuid)
         AND ($3::uuid IS NULL OR t.store_id = $3::uuid)`,
      [ticketId, userId, storeId]
    );
    return rows[0] || null;
  }
}

module.exports = { PgSupportReadModel };
