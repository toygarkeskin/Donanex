"use strict";

import type { Pool } from "pg";
import { escapeLike, money, binder, paginate } from "./sql";
import type { CatalogReadModel, ListFilters, Row } from "../../../../application/shared/contracts";

const CARD = `
  p.id, p.slug, p.name, p.image_url AS "imageUrl", p.stock, p.status,
  ${money("p.price_cents")} AS price,
  s.id AS "storeId", s.slug AS "storeSlug", s.name AS "storeName",
  c.slug AS "categorySlug", c.name AS "categoryName"`;

/**
 * Sıralama seçenekleri BURADA sabittir: kullanıcının gönderdiği metin asla
 * doğrudan ORDER BY'a girmez, yalnızca bu haritada anahtar arar.
 */
const SORTS: Record<string, string> = {
  newest: "p.created_at DESC, p.id DESC",
  price_asc: "p.price_cents ASC, p.id",
  price_desc: "p.price_cents DESC, p.id",
  name_asc: "p.name ASC, p.id"
};

export class PgCatalogReadModel implements CatalogReadModel {
  private readonly db: Pool;

  constructor(pool: Pool) {
    this.db = pool;
  }

  /** Vitrin: yalnızca aktif mağazaların yayındaki ürünleri. */
  async listProducts(filters: ListFilters): Promise<Row> {
    const { params, bind } = binder();
    const where = ["p.status = 'active'", "s.status = 'active'"];

    if (filters.search) {
      const term = bind(`%${escapeLike(filters.search)}%`);
      where.push(`(p.name ILIKE ${term} OR p.description ILIKE ${term} OR s.name ILIKE ${term})`);
    }
    if (filters.categorySlug) where.push(`c.slug = ${bind(filters.categorySlug)}`);
    if (filters.storeSlug) where.push(`s.slug = ${bind(filters.storeSlug)}`);
    if (filters.minPriceCents !== null) where.push(`p.price_cents >= ${bind(filters.minPriceCents)}`);
    if (filters.maxPriceCents !== null) where.push(`p.price_cents <= ${bind(filters.maxPriceCents)}`);
    if (filters.inStockOnly) where.push("p.stock > 0");

    const from = `
      FROM products p
      JOIN stores s ON s.id = p.store_id
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE ${where.join(" AND ")}`;

    const count = await this.db.query(`SELECT COUNT(*)::int AS total ${from}`, params);
    const { rows } = await this.db.query(
      `SELECT ${CARD} ${from}
       ORDER BY ${SORTS[filters.sort] || SORTS.newest}
       LIMIT ${bind(filters.limit)} OFFSET ${bind(filters.offset)}`,
      params
    );
    return paginate(rows, count.rows[0].total, filters);
  }

  async getProductBySlug(storeSlug: string, productSlug: string): Promise<Row | null> {
    const { rows } = await this.db.query(
      `SELECT ${CARD}, p.description, p.sku, s.description AS "storeDescription"
       FROM products p
       JOIN stores s ON s.id = p.store_id
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE s.slug = $1 AND p.slug = $2 AND p.status = 'active' AND s.status = 'active'`,
      [storeSlug, productSlug]
    );
    return rows[0] || null;
  }

  async listCategories(): Promise<Row[]> {
    const { rows } = await this.db.query(
      `SELECT c.id, c.slug, c.name, COUNT(p.id)::int AS "productCount"
       FROM categories c
       LEFT JOIN products p ON p.category_id = c.id AND p.status = 'active'
       LEFT JOIN stores s ON s.id = p.store_id AND s.status = 'active'
       GROUP BY c.id
       ORDER BY c.position, c.name`
    );
    return rows;
  }

  /** Mağaza paneli: taslak ve arşivli ürünler de görünür. */
  async listStoreProducts(storeId: string, filters: ListFilters): Promise<Row> {
    const { params, bind } = binder([storeId]);
    const where = ["p.store_id = $1"];

    if (filters.search) {
      const term = bind(`%${escapeLike(filters.search)}%`);
      where.push(`(p.name ILIKE ${term} OR p.sku ILIKE ${term})`);
    }
    if (filters.status) where.push(`p.status = ${bind(filters.status)}`);

    const from = `FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE ${where.join(" AND ")}`;
    const count = await this.db.query(`SELECT COUNT(*)::int AS total ${from}`, params);
    const { rows } = await this.db.query(
      `SELECT p.id, p.slug, p.sku, p.name, p.description, p.stock, p.status,
              p.image_url AS "imageUrl", p.category_id AS "categoryId",
              c.name AS "categoryName", ${money("p.price_cents")} AS price,
              p.created_at AS "createdAt",
              EXISTS (SELECT 1 FROM order_items oi WHERE oi.product_id = p.id) AS "hasOrders"
       ${from}
       ORDER BY p.created_at DESC
       LIMIT ${bind(filters.limit)} OFFSET ${bind(filters.offset)}`,
      params
    );
    return paginate(rows, count.rows[0].total, filters);
  }

  async getProductForStore(storeId: string, productId: string): Promise<Row | null> {
    const { rows } = await this.db.query(
      `SELECT p.id, p.slug, p.sku, p.name, p.description, p.stock, p.status,
              p.image_url AS "imageUrl", p.category_id AS "categoryId",
              ${money("p.price_cents")} AS price
       FROM products p WHERE p.id = $1 AND p.store_id = $2`,
      [productId, storeId]
    );
    return rows[0] || null;
  }
}
