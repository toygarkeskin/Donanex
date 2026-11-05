"use strict";

class PgRoleRepository {
  constructor(client) {
    this.db = client;
  }

  async findByCode(code) {
    const { rows } = await this.db.query(
      "SELECT code, name, scope, is_system AS \"isSystem\" FROM roles WHERE code = $1",
      [code]
    );
    return rows[0] || null;
  }

  async assign({ userId, roleCode, storeId }) {
    await this.db.query(
      `INSERT INTO user_roles (user_id, role_code, store_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, role_code, COALESCE(store_id, '00000000-0000-0000-0000-000000000000'::uuid))
       DO NOTHING`,
      [userId, roleCode, storeId]
    );
  }

  async revoke({ userId, roleCode, storeId }) {
    const result = await this.db.query(
      `DELETE FROM user_roles
       WHERE user_id = $1 AND role_code = $2
         AND COALESCE(store_id, '00000000-0000-0000-0000-000000000000'::uuid)
           = COALESCE($3::uuid, '00000000-0000-0000-0000-000000000000'::uuid)`,
      [userId, roleCode, storeId]
    );
    return result.rowCount > 0;
  }

  /** Kullanıcının tüm rol atamaları ve her atamanın getirdiği izinler. */
  async listForUser(userId) {
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

  async countByCode(roleCode) {
    const { rows } = await this.db.query(
      "SELECT COUNT(*)::int AS total FROM user_roles WHERE role_code = $1",
      [roleCode]
    );
    return rows[0].total;
  }

  async hasRole(userId, roleCode) {
    const { rows } = await this.db.query(
      "SELECT EXISTS (SELECT 1 FROM user_roles WHERE user_id = $1 AND role_code = $2) AS found",
      [userId, roleCode]
    );
    return rows[0].found;
  }
}

module.exports = { PgRoleRepository };
