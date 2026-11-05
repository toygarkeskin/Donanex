"use strict";

const COLUMNS = `
  id, store_id AS "storeId", category_id AS "categoryId", slug, sku, name, description,
  price_cents AS "priceCents", stock, image_url AS "imageUrl", status, created_at AS "createdAt"`;

class PgProductRepository {
  constructor(client) {
    this.db = client;
  }

  /** Aynı mağazada benzersiz adres (slug) üretir: "klavye", "klavye-2", ... */
  async reserveSlug(storeId, desired) {
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

  async create(product) {
    const { rows } = await this.db.query(
      `INSERT INTO products (id, store_id, category_id, slug, sku, name, description, price_cents, stock, image_url, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING ${COLUMNS}`,
      [product.id, product.storeId, product.categoryId, product.slug, product.sku, product.name, product.description, product.price.cents, product.stock, product.imageUrl, product.status]
    );
    return rows[0];
  }

  async createMany(products) {
    if (!products.length) return 0;
    const values = [];
    const params = [];
    products.forEach((product, index) => {
      const offset = index * 11;
      values.push(`(${Array.from({ length: 11 }, (_, i) => `$${offset + i + 1}`).join(", ")})`);
      params.push(product.id, product.storeId, product.categoryId, product.slug, product.sku, product.name, product.description, product.price.cents, product.stock, product.imageUrl, product.status);
    });
    const result = await this.db.query(
      `INSERT INTO products (id, store_id, category_id, slug, sku, name, description, price_cents, stock, image_url, status)
       VALUES ${values.join(", ")}`,
      params
    );
    return result.rowCount;
  }

  /** storeId sorgunun parçası: başka mağazanın ürünü güncellenemez. */
  async update(storeId, product) {
    const { rows } = await this.db.query(
      `UPDATE products
       SET category_id = $1, sku = $2, name = $3, description = $4,
           price_cents = $5, stock = $6, image_url = $7, status = $8, updated_at = NOW()
       WHERE id = $9 AND store_id = $10
       RETURNING ${COLUMNS}`,
      [product.categoryId, product.sku, product.name, product.description, product.price.cents, product.stock, product.imageUrl, product.status, product.id, storeId]
    );
    return rows[0] || null;
  }

  async setStatus(storeId, productId, status) {
    const { rows } = await this.db.query(
      `UPDATE products SET status = $1, updated_at = NOW()
       WHERE id = $2 AND store_id = $3
       RETURNING ${COLUMNS}`,
      [status, productId, storeId]
    );
    return rows[0] || null;
  }

  async remove(storeId, productId) {
    const result = await this.db.query("DELETE FROM products WHERE id = $1 AND store_id = $2", [productId, storeId]);
    return result.rowCount > 0;
  }

  async isReferencedByOrders(productId) {
    const { rows } = await this.db.query(
      "SELECT EXISTS (SELECT 1 FROM order_items WHERE product_id = $1) AS used",
      [productId]
    );
    return rows[0].used;
  }

  /** Sepete eklenebilir mi? Mağazası da aktif olmalı. */
  async findPurchasable(productId) {
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
   */
  async lockForOrder(productIds) {
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
    return new Map(rows.map((row) => [row.id, row]));
  }

  async decreaseStock(productId, quantity) {
    await this.db.query("UPDATE products SET stock = stock - $1, updated_at = NOW() WHERE id = $2", [quantity, productId]);
  }

  async increaseStock(productId, quantity) {
    await this.db.query("UPDATE products SET stock = stock + $1, updated_at = NOW() WHERE id = $2", [quantity, productId]);
  }
}

module.exports = { PgProductRepository };
