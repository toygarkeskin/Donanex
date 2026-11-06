"use strict";

import type { Db } from "../pool";
import type { RoleRepository, Row } from "../../../../application/shared/contracts";
import type { RoleAssignment } from "../../../../domain/identity/AccessPolicy";

export class PgRoleRepository implements RoleRepository {
  private readonly db: Db;

  constructor(client: Db) {
    this.db = client;
  }

  async findByCode(code: string): Promise<Row | null> {
    const { rows } = await this.db.query(
      'SELECT code, name, scope, is_system AS "isSystem" FROM roles WHERE code = $1',
      [code]
    );
    return rows[0] || null;
  }

  async assign({
    userId,
    roleCode,
    storeId
  }: {
    userId: string;
    roleCode: string;
    storeId?: string | null;
  }): Promise<void> {
    await this.db.query(
      `INSERT INTO user_roles (user_id, role_code, store_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, role_code, COALESCE(store_id, '00000000-0000-0000-0000-000000000000'::uuid))
       DO NOTHING`,
      [userId, roleCode, storeId]
    );
  }

  async revoke({
    userId,
    roleCode,
    storeId
  }: {
    userId: string;
    roleCode: string;
    storeId?: string | null;
  }): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM user_roles
       WHERE user_id = $1 AND role_code = $2
         AND COALESCE(store_id, '00000000-0000-0000-0000-000000000000'::uuid)
           = COALESCE($3::uuid, '00000000-0000-0000-0000-000000000000'::uuid)`,
      [userId, roleCode, storeId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /** Kullanıcının tüm rol atamaları ve her atamanın getirdiği izinler. */
  async listForUser(userId: string): Promise<RoleAssignment[]> {
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
    return rows as RoleAssignment[];
  }

  async countByCode(roleCode: string): Promise<number> {
    const { rows } = await this.db.query("SELECT COUNT(*)::int AS total FROM user_roles WHERE role_code = $1", [
      roleCode
    ]);
    return rows[0].total;
  }

  async hasRole(userId: string, roleCode: string): Promise<boolean> {
    const { rows } = await this.db.query(
      "SELECT EXISTS (SELECT 1 FROM user_roles WHERE user_id = $1 AND role_code = $2) AS found",
      [userId, roleCode]
    );
    return rows[0].found;
  }
}
