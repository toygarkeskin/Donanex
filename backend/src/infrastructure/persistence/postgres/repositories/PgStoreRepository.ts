"use strict";

import type { Db } from "../pool";
import type { Row, StoreRepository } from "../../../../application/shared/contracts";

const COLUMNS = `
  id, slug, name, description, contact_email AS "contactEmail", phone,
  tax_number AS "taxNumber", logo_url AS "logoUrl", status,
  owner_user_id AS "ownerUserId", created_at AS "createdAt"`;

export class PgStoreRepository implements StoreRepository {
  private readonly db: Db;

  constructor(client: Db) {
    this.db = client;
  }

  async create(store: Row): Promise<Row> {
    const { rows } = await this.db.query(
      `INSERT INTO stores (id, slug, name, description, contact_email, phone, tax_number, status, owner_user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING ${COLUMNS}`,
      [
        store.id,
        store.slug,
        store.name,
        store.description,
        store.contactEmail,
        store.phone,
        store.taxNumber,
        store.status,
        store.ownerUserId
      ]
    );
    return rows[0];
  }

  async findById(id: string): Promise<Row | null> {
    const { rows } = await this.db.query(`SELECT ${COLUMNS} FROM stores WHERE id = $1`, [id]);
    return rows[0] || null;
  }

  async exists(id: string): Promise<boolean> {
    const { rows } = await this.db.query("SELECT EXISTS (SELECT 1 FROM stores WHERE id = $1) AS found", [id]);
    return rows[0].found;
  }

  async slugExists(slug: string): Promise<boolean> {
    const { rows } = await this.db.query("SELECT EXISTS (SELECT 1 FROM stores WHERE slug = $1) AS found", [slug]);
    return rows[0].found;
  }

  async hasPendingApplication(userId: string): Promise<boolean> {
    const { rows } = await this.db.query(
      "SELECT EXISTS (SELECT 1 FROM stores WHERE owner_user_id = $1 AND status = 'pending') AS found",
      [userId]
    );
    return rows[0].found;
  }

  async update(id: string, data: Row): Promise<Row | null> {
    const { rows } = await this.db.query(
      `UPDATE stores
       SET name = $1, description = $2, contact_email = $3, phone = $4, updated_at = NOW()
       WHERE id = $5
       RETURNING ${COLUMNS}`,
      [data.name, data.description, data.contactEmail, data.phone, id]
    );
    return rows[0] || null;
  }

  async setStatus(id: string, status: string): Promise<Row | null> {
    const { rows } = await this.db.query(
      `UPDATE stores SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING ${COLUMNS}`,
      [status, id]
    );
    return rows[0] || null;
  }
}
