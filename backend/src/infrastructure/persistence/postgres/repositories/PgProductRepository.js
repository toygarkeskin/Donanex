"use strict";

const RETURNING = "RETURNING id, name, description, price, image, category, stock, is_active";

class PgProductRepository {
  constructor(client) {
    this.db = client;
  }

  /** Sipariş sırasında ürün satırlarını kilitler; id sırası kilitlenmeyi (deadlock) önler. */
  async lockActiveByIds(ids) {
    const { rows } = await this.db.query(
      `SELECT id, name, price, stock FROM products
       WHERE id = ANY($1::int[]) AND is_active ORDER BY id FOR UPDATE`,
      [ids]
    );
    return rows;
  }

  async add(product) {
    const { rows } = await this.db.query(
      `INSERT INTO products (name, description, price, image, category, stock)
       VALUES ($1, $2, $3, $4, $5, $6) ${RETURNING}`,
      [product.name, product.description, product.price, product.image, product.category, product.stock]
    );
    return rows[0];
  }

  async addMany(products) {
    if (!products.length) return 0;
    const values = [];
    const params = [];
    products.forEach((p, i) => {
      const o = i * 6;
      values.push(`($${o + 1}, $${o + 2}, $${o + 3}, $${o + 4}, $${o + 5}, $${o + 6})`);
      params.push(p.name, p.description, p.price, p.image, p.category, p.stock);
    });
    const result = await this.db.query(
      `INSERT INTO products (name, description, price, image, category, stock)
       VALUES ${values.join(", ")}`,
      params
    );
    return result.rowCount;
  }

  async update(product) {
    const { rows } = await this.db.query(
      `UPDATE products
       SET name = $1, description = $2, price = $3, image = $4, category = $5, stock = $6
       WHERE id = $7 ${RETURNING}`,
      [product.name, product.description, product.price, product.image, product.category, product.stock, product.id]
    );
    return rows[0] || null;
  }

  async isReferencedByOrders(id) {
    const { rows } = await this.db.query(
      "SELECT EXISTS (SELECT 1 FROM order_items WHERE product_id = $1) AS used",
      [id]
    );
    return rows[0].used;
  }

  async setActive(id, active) {
    const result = await this.db.query("UPDATE products SET is_active = $1 WHERE id = $2", [active, id]);
    return result.rowCount > 0;
  }

  async remove(id) {
    const result = await this.db.query("DELETE FROM products WHERE id = $1", [id]);
    return result.rowCount > 0;
  }

  async decreaseStock(productId, quantity) {
    await this.db.query("UPDATE products SET stock = stock - $1 WHERE id = $2", [quantity, productId]);
  }

  async increaseStock(productId, quantity) {
    await this.db.query("UPDATE products SET stock = stock + $1 WHERE id = $2", [quantity, productId]);
  }
}

module.exports = { PgProductRepository };
