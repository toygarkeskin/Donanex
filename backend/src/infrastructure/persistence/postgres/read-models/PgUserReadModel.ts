"use strict";

import type { Pool } from "pg";
import { escapeLike, binder, paginate } from "./sql";
import type { RoleAssignment as RoleAssignmentRow } from "../../../../domain/identity/AccessPolicy";
import type { ListFilters, Row, UserReadModel } from "../../../../application/shared/contracts";

export class PgUserReadModel implements UserReadModel {
  private readonly db: Pool;

  constructor(pool: Pool) {
    this.db = pool;
  }

  async getProfile(userId: string): Promise<Row | null> {
    const { rows } = await this.db.query(
      `SELECT id, email, full_name AS "fullName", phone,
              email_verified AS "emailVerified", status, created_at AS "createdAt"
       FROM users WHERE id = $1`,
      [userId]
    );
    return rows[0] || null;
  }

  /** AccessPolicy'nin kurulduğu kaynak: rol atamaları ve getirdikleri izinler. */
  async getAccessPolicy(userId: string): Promise<RoleAssignmentRow[]> {
    const { rows } = await this.db.query(
      `SELECT ur.role_code AS "roleCode",
              ur.store_id  AS "storeId",
              COALESCE(ARRAY_AGG(rp.permission_code) FILTER (WHERE rp.permission_code IS NOT NULL), '{}') AS permissions
       FROM user_roles ur
       LEFT JOIN role_permissions rp ON rp.role_code = ur.role_code
       WHERE ur.user_id = $1
       GROUP BY ur.role_code, ur.store_id`,
      [userId]
    );
    return rows;
  }

  async getSessionVersion(userId: string): Promise<number | null> {
    const { rows } = await this.db.query("SELECT session_version AS version, status FROM users WHERE id = $1", [
      userId
    ]);
    if (!rows[0] || rows[0].status !== "active") return null;
    return rows[0].version;
  }

  async listAddresses(userId: string): Promise<Row[]> {
    const { rows } = await this.db.query(
      `SELECT id, title, full_name AS "fullName", phone, city, district, line,
              postal_code AS "postalCode"
       FROM user_addresses WHERE user_id = $1 ORDER BY created_at`,
      [userId]
    );
    return rows;
  }

  async listForAdmin(filters: ListFilters): Promise<Row> {
    const { params, bind } = binder();
    const where: string[] = [];

    if (filters.search) {
      const term = bind(`%${escapeLike(filters.search)}%`);
      where.push(`(u.full_name ILIKE ${term} OR u.email ILIKE ${term})`);
    }
    if (filters.status) where.push(`u.status = ${bind(filters.status)}`);
    if (filters.role) {
      where.push(
        `EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role_code = ${bind(filters.role)})`
      );
    }

    const from = `FROM users u ${where.length ? `WHERE ${where.join(" AND ")}` : ""}`;
    const count = await this.db.query(`SELECT COUNT(*)::int AS total ${from}`, params);
    const { rows } = await this.db.query(
      `SELECT u.id, u.email, u.full_name AS "fullName", u.status,
              u.email_verified AS "emailVerified", u.created_at AS "createdAt",
              u.last_login_at AS "lastLoginAt",
              COALESCE((
                SELECT json_agg(json_build_object(
                  'roleCode', ur.role_code, 'storeId', ur.store_id, 'storeName', st.name
                ) ORDER BY ur.role_code)
                FROM user_roles ur
                LEFT JOIN stores st ON st.id = ur.store_id
                WHERE ur.user_id = u.id
              ), '[]'::json) AS roles
       ${from}
       ORDER BY u.created_at DESC
       LIMIT ${bind(filters.limit)} OFFSET ${bind(filters.offset)}`,
      params
    );
    return paginate(rows, count.rows[0].total, filters);
  }
}
