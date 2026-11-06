"use strict";

import type { Pool } from "pg";
import { escapeLike, binder, paginate } from "./sql";
import type { ListFilters, Row, StoreReadModel } from "../../../../application/shared/contracts";

const PUBLIC = `
  s.id, s.slug, s.name, s.description, s.logo_url AS "logoUrl", s.created_at AS "createdAt"`;

export class PgStoreReadModel implements StoreReadModel {
  private readonly db: Pool;

  constructor(pool: Pool) {
    this.db = pool;
  }

  async getBySlug(slug: string): Promise<Row | null> {
    const { rows } = await this.db.query(
      `SELECT ${PUBLIC},
              (SELECT COUNT(*)::int FROM products p WHERE p.store_id = s.id AND p.status = 'active') AS "productCount"
       FROM stores s
       WHERE s.slug = $1 AND s.status = 'active'`,
      [slug]
    );
    return rows[0] || null;
  }

  async listPublic({ search, limit }: Row): Promise<Row[]> {
    const { params, bind } = binder();
    const where = ["s.status = 'active'"];
    if (search) {
      const term = bind(`%${escapeLike(search)}%`);
      where.push(`(s.name ILIKE ${term} OR s.description ILIKE ${term})`);
    }
    const { rows } = await this.db.query(
      `SELECT ${PUBLIC},
              (SELECT COUNT(*)::int FROM products p WHERE p.store_id = s.id AND p.status = 'active') AS "productCount"
       FROM stores s
       WHERE ${where.join(" AND ")}
       ORDER BY s.name
       LIMIT ${bind(limit)}`,
      params
    );
    return rows;
  }

  async listForAdmin(filters: ListFilters): Promise<Row> {
    const { params, bind } = binder();
    const where: string[] = [];
    if (filters.search) {
      const term = bind(`%${escapeLike(filters.search)}%`);
      where.push(`(s.name ILIKE ${term} OR s.contact_email ILIKE ${term} OR u.email ILIKE ${term})`);
    }
    if (filters.status) where.push(`s.status = ${bind(filters.status)}`);

    const from = `FROM stores s JOIN users u ON u.id = s.owner_user_id ${where.length ? `WHERE ${where.join(" AND ")}` : ""}`;
    const count = await this.db.query(`SELECT COUNT(*)::int AS total ${from}`, params);
    const { rows } = await this.db.query(
      `SELECT ${PUBLIC}, s.status, s.contact_email AS "contactEmail", s.phone, s.tax_number AS "taxNumber",
              u.id AS "ownerId", u.full_name AS "ownerName", u.email AS "ownerEmail",
              (SELECT COUNT(*)::int FROM products p WHERE p.store_id = s.id) AS "productCount",
              (SELECT COUNT(*)::int FROM order_packages op WHERE op.store_id = s.id) AS "orderCount"
       ${from}
       ORDER BY
         CASE s.status WHEN 'pending' THEN 0 WHEN 'active' THEN 1 ELSE 2 END,
         s.created_at DESC
       LIMIT ${bind(filters.limit)} OFFSET ${bind(filters.offset)}`,
      params
    );
    return paginate(rows, count.rows[0].total, filters);
  }

  async getForMember(storeId: string): Promise<Row | null> {
    const { rows } = await this.db.query(
      `SELECT ${PUBLIC}, s.status, s.contact_email AS "contactEmail", s.phone, s.tax_number AS "taxNumber"
       FROM stores s WHERE s.id = $1`,
      [storeId]
    );
    return rows[0] || null;
  }

  /** Kişinin yetkili olduğu mağazalar — panel menüsünü kurmak için. */
  async listForMember(storeIds: readonly string[]): Promise<Row[]> {
    if (!storeIds.length) return [];
    const { rows } = await this.db.query(
      `SELECT ${PUBLIC}, s.status FROM stores s WHERE s.id = ANY($1::uuid[]) ORDER BY s.name`,
      [storeIds]
    );
    return rows;
  }

  async listMembers(storeId: string): Promise<Row[]> {
    const { rows } = await this.db.query(
      `SELECT u.id, u.full_name AS "fullName", u.email, ur.role_code AS "roleCode",
              r.name AS "roleName", ur.granted_at AS "grantedAt",
              (s.owner_user_id = u.id) AS "isOwner"
       FROM user_roles ur
       JOIN users u ON u.id = ur.user_id
       JOIN roles r ON r.code = ur.role_code
       JOIN stores s ON s.id = ur.store_id
       WHERE ur.store_id = $1
       ORDER BY "isOwner" DESC, u.full_name`,
      [storeId]
    );
    return rows;
  }
}
