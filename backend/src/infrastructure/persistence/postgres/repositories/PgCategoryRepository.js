"use strict";

class PgCategoryRepository {
  constructor(client) {
    this.db = client;
  }

  async create({ id, name, slug, parentId }) {
    const { rows } = await this.db.query(
      `INSERT INTO categories (id, slug, name, parent_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (slug) DO NOTHING
       RETURNING id, slug, name, parent_id AS "parentId"`,
      [id, slug, name, parentId]
    );
    return rows[0] || null;
  }

  async findBySlug(slug) {
    const { rows } = await this.db.query("SELECT id, slug, name FROM categories WHERE slug = $1", [slug]);
    return rows[0] || null;
  }
}

module.exports = { PgCategoryRepository };
