"use strict";

const COLUMNS = `id, user_id AS "userId", status`;

class PgCartRepository {
  constructor(client) {
    this.db = client;
  }

  async findById(id) {
    if (!id) return null;
    const { rows } = await this.db.query(
      `SELECT ${COLUMNS} FROM carts WHERE id = $1 AND status = 'active'`,
      [id]
    );
    return rows[0] || null;
  }

  async findByUser(userId) {
    const { rows } = await this.db.query(
      `SELECT ${COLUMNS} FROM carts WHERE user_id = $1 AND status = 'active'`,
      [userId]
    );
    return rows[0] || null;
  }

  async findOrCreateForUser(userId) {
    const existing = await this.findByUser(userId);
    if (existing) return existing;
    const { rows } = await this.db.query(
      `INSERT INTO carts (id, user_id) VALUES (gen_random_uuid(), $1)
       ON CONFLICT (user_id) WHERE user_id IS NOT NULL AND status = 'active' DO NOTHING
       RETURNING ${COLUMNS}`,
      [userId]
    );
    return rows[0] || (await this.findByUser(userId));
  }

  async createGuestCart() {
    const { rows } = await this.db.query(
      `INSERT INTO carts (id) VALUES (gen_random_uuid()) RETURNING ${COLUMNS}`
    );
    return rows[0];
  }

  async listLines(cartId) {
    const { rows } = await this.db.query(
      `SELECT product_id AS "productId", quantity FROM cart_items WHERE cart_id = $1 ORDER BY added_at`,
      [cartId]
    );
    return rows;
  }

  async setLine(cartId, productId, quantity) {
    const { rows } = await this.db.query(
      `INSERT INTO cart_items (cart_id, product_id, quantity)
       VALUES ($1, $2, $3)
       ON CONFLICT (cart_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity
       RETURNING quantity`,
      [cartId, productId, quantity]
    );
    await this.touch(cartId);
    return rows[0] || null;
  }

  async removeLine(cartId, productId) {
    await this.db.query("DELETE FROM cart_items WHERE cart_id = $1 AND product_id = $2", [cartId, productId]);
    await this.touch(cartId);
  }

  async replaceLines(cartId, lines) {
    await this.db.query("DELETE FROM cart_items WHERE cart_id = $1", [cartId]);
    for (const line of lines) {
      await this.db.query(
        "INSERT INTO cart_items (cart_id, product_id, quantity) VALUES ($1, $2, $3)",
        [cartId, line.productId, line.quantity]
      );
    }
    await this.touch(cartId);
  }

  async remove(cartId) {
    await this.db.query("DELETE FROM carts WHERE id = $1", [cartId]);
  }

  async markConverted(cartId, orderId) {
    await this.db.query(
      "UPDATE carts SET status = 'converted', converted_order_id = $1, updated_at = NOW() WHERE id = $2",
      [orderId, cartId]
    );
  }

  async touch(cartId) {
    await this.db.query("UPDATE carts SET updated_at = NOW() WHERE id = $1", [cartId]);
  }

  /** Uzun süre dokunulmamış misafir sepetlerini temizler. */
  async purgeAbandonedGuestCarts(before) {
    const result = await this.db.query(
      "DELETE FROM carts WHERE user_id IS NULL AND status = 'active' AND updated_at < $1",
      [before]
    );
    return result.rowCount;
  }
}

module.exports = { PgCartRepository };
