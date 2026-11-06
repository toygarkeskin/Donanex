"use strict";

import type { Db } from "../pool";
import type { CategoryRepository, Row } from "../../../../application/shared/contracts";

export class PgCategoryRepository implements CategoryRepository {
  private readonly db: Db;

  constructor(client: Db) {
    this.db = client;
  }

  async create({
    id,
    name,
    slug,
    parentId
  }: {
    id: string;
    name: string;
    slug: string;
    parentId: string | null;
  }): Promise<Row | null> {
    const { rows } = await this.db.query(
      `INSERT INTO categories (id, slug, name, parent_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (slug) DO NOTHING
       RETURNING id, slug, name, parent_id AS "parentId"`,
      [id, slug, name, parentId]
    );
    return rows[0] || null;
  }

  async findBySlug(slug: string): Promise<Row | null> {
    const { rows } = await this.db.query("SELECT id, slug, name FROM categories WHERE slug = $1", [slug]);
    return rows[0] || null;
  }
}
