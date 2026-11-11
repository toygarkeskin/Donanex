"use strict";

import type { Db } from "../pool";
import type { ProductRepository, Row } from "../../../../application/shared/contracts";

const COLUMNS = `
  id, store_id AS "storeId", category_id AS "categoryId", slug, sku, name, description,
  price_cents AS "priceCents", stock, image_url AS "imageUrl", gallery_urls AS "galleryUrls",
  status, created_at AS "createdAt"`;

export class PgProductRepository implements ProductRepository {
  private readonly db: Db;

  constructor(client: Db) {
    this.db = client;
  }

  /** Aynı mağazada benzersiz adres (slug) üretir: "klavye", "klavye-2", ... */
  async reserveSlug(storeId: string, desired: string): Promise<string> {
    const base = desired || "urun";
    for (let suffix = 0; suffix < 50; suffix++) {
      const candidate = suffix === 0 ? base : `${base}-${suffix + 1}`;
      const { rows } = await this.db.query(
        "SELECT EXISTS (SELECT 1 FROM products WHERE store_id = $1 AND slug = $2) AS taken",
        [storeId, candidate]
      );
      if (!rows[0].taken) return candidate;
    }
    return `${base}-${Date.now()}`;
  }

  async create(product: Row): Promise<Row> {
    const { rows } = await this.db.query(
      `INSERT INTO products
         (id, store_id, category_id, slug, sku, name, description, price_cents, stock, image_url, gallery_urls, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING ${COLUMNS}`,
      [
        product.id,
        product.storeId,
        product.categoryId,
        product.slug,
        product.sku,
        product.name,
        product.description,
        product.price.cents,
        product.stock,
        product.imageUrl,
        product.galleryUrls,
        product.status
      ]
    );
    return rows[0];
  }

  async createMany(products: readonly Row[]): Promise<number> {
    if (!products.length) return 0;
    const values: string[] = [];
    const params: unknown[] = [];
    // Kolon sayısı tek yerde: liste ile yer tutucu sayısı ayrı ayrı
    // güncellenirse parametreler sessizce kayar.
    const SUTUN_SAYISI = 12;
    products.forEach((product, index) => {
      const offset = index * SUTUN_SAYISI;
      values.push(`(${Array.from({ length: SUTUN_SAYISI }, (_, i) => `$${offset + i + 1}`).join(", ")})`);
      params.push(
        product.id,
        product.storeId,
        product.categoryId,
        product.slug,
        product.sku,
        product.name,
        product.description,
        product.price.cents,
        product.stock,
        product.imageUrl,
        product.galleryUrls,
        product.status
      );
    });
    const result = await this.db.query(
      `INSERT INTO products
         (id, store_id, category_id, slug, sku, name, description, price_cents, stock, image_url, gallery_urls, status)
       VALUES ${values.join(", ")}`,
      params
    );
    return result.rowCount ?? 0;
  }

  /** storeId sorgunun parçası: başka mağazanın ürünü güncellenemez. */
  async update(storeId: string, product: Row): Promise<Row | null> {
    const { rows } = await this.db.query(
      `UPDATE products
       SET category_id = $1, sku = $2, name = $3, description = $4,
           price_cents = $5, stock = $6, image_url = $7, gallery_urls = $8,
           status = $9, updated_at = NOW()
       WHERE id = $10 AND store_id = $11
       RETURNING ${COLUMNS}`,
      [
        product.categoryId,
        product.sku,
        product.name,
        product.description,
        product.price.cents,
        product.stock,
        product.imageUrl,
        product.galleryUrls,
        product.status,
        product.id,
        storeId
      ]
    );
    return rows[0] || null;
  }

  async setStatus(storeId: string, productId: string, status: string): Promise<Row | null> {
    const { rows } = await this.db.query(
      `UPDATE products SET status = $1, updated_at = NOW()
       WHERE id = $2 AND store_id = $3
       RETURNING ${COLUMNS}`,
      [status, productId, storeId]
    );
    return rows[0] || null;
  }

  async remove(storeId: string, productId: string): Promise<boolean> {
    const result = await this.db.query("DELETE FROM products WHERE id = $1 AND store_id = $2", [productId, storeId]);
    return (result.rowCount ?? 0) > 0;
  }

  async isReferencedByOrders(productId: string): Promise<boolean> {
    const { rows } = await this.db.query("SELECT EXISTS (SELECT 1 FROM order_items WHERE product_id = $1) AS used", [
      productId
    ]);
    return rows[0].used;
  }

  /** Sepete eklenebilir mi? Mağazası da aktif olmalı. */
  async findPurchasable(productId: string): Promise<Row | null> {
    const { rows } = await this.db.query(
      `SELECT p.id, p.name, p.price_cents AS "priceCents", p.stock, p.status
       FROM products p
       JOIN stores s ON s.id = p.store_id
       WHERE p.id = $1 AND p.status = 'active' AND s.status = 'active'`,
      [productId]
    );
    return rows[0] || null;
  }

  /**
   * Sipariş anında ürün satırlarını kilitler.
   * ORDER BY p.id: iki eşzamanlı sipariş satırları hep aynı sırada kilitler,
   * böylece karşılıklı kilitlenme (deadlock) oluşmaz.
   *
   * MAP döndürür: çağıran .get(productId) ile arar.
   */
  async lockForOrder(productIds: readonly string[]): Promise<Map<string, Row>> {
    const { rows } = await this.db.query(
      `SELECT p.id, p.name, p.price_cents AS "priceCents", p.stock, p.status,
              p.image_url AS "imageUrl", p.store_id AS "storeId",
              s.name AS "storeName", s.status AS "storeStatus"
       FROM products p
       JOIN stores s ON s.id = p.store_id
       WHERE p.id = ANY($1::uuid[])
       ORDER BY p.id
       FOR UPDATE OF p`,
      [productIds]
    );
    return new Map(rows.map((row) => [row.id as string, row as Row]));
  }

  async decreaseStock(productId: string, quantity: number): Promise<void> {
    await this.db.query("UPDATE products SET stock = stock - $1, updated_at = NOW() WHERE id = $2", [
      quantity,
      productId
    ]);
  }

  async increaseStock(productId: string, quantity: number): Promise<void> {
    await this.db.query("UPDATE products SET stock = stock + $1, updated_at = NOW() WHERE id = $2", [
      quantity,
      productId
    ]);
  }
}
