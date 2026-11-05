"use strict";

const STORE_COLUMNS = "id, name, description, price, image, category, stock";
const MAX_RESULTS = 500;

/** LIKE içindeki % ve _ karakterleri kullanıcı girdisinde joker sayılmasın. */
const escapeLike = (text) => text.replace(/[\\%_]/g, (char) => `\\${char}`);

class PgProductReadModel {
  constructor(pool) {
    this.db = pool;
  }

  async listForStore({ search = "", categories = [], ids = null } = {}) {
    const where = ["is_active"];
    const params = [];
    const bind = (value) => {
      params.push(value);
      return `$${params.length}`;
    };

    if (search) {
      const term = bind(`%${escapeLike(search)}%`);
      where.push(`(name ILIKE ${term} OR description ILIKE ${term} OR category ILIKE ${term})`);
    }
    if (categories.length) where.push(`category = ANY(${bind(categories)}::varchar[])`);
    if (ids) where.push(`id = ANY(${bind(ids)}::int[])`);

    const { rows } = await this.db.query(
      `SELECT ${STORE_COLUMNS} FROM products
       WHERE ${where.join(" AND ")}
       ORDER BY id LIMIT ${MAX_RESULTS}`,
      params
    );
    return rows;
  }

  async listCategories() {
    const { rows } = await this.db.query(
      "SELECT DISTINCT category FROM products WHERE is_active ORDER BY category"
    );
    return rows.map((row) => row.category);
  }

  async listForAdmin() {
    const { rows } = await this.db.query(
      `SELECT ${STORE_COLUMNS}, is_active, created_at
       FROM products ORDER BY is_active DESC, id DESC`
    );
    return rows;
  }
}

module.exports = { PgProductReadModel };
