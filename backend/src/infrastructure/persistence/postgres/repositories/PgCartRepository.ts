"use strict";

import type { Db } from "../pool";
import type { CartRepository, Row } from "../../../../application/shared/contracts";
import type { CartLine } from "../../../../domain/ordering/Cart";

const COLUMNS = `id, user_id AS "userId", status`;

export class PgCartRepository implements CartRepository {
  private readonly db: Db;

  constructor(client: Db) {
    this.db = client;
  }

  async findById(id: string | null): Promise<Row | null> {
    if (!id) return null;
    const { rows } = await this.db.query(`SELECT ${COLUMNS} FROM carts WHERE id = $1 AND status = 'active'`, [id]);
    return rows[0] || null;
  }

  async findByUser(userId: string): Promise<Row | null> {
    const { rows } = await this.db.query(`SELECT ${COLUMNS} FROM carts WHERE user_id = $1 AND status = 'active'`, [
      userId
    ]);
    return rows[0] || null;
  }

  async findOrCreateForUser(userId: string): Promise<Row> {
    const existing = await this.findByUser(userId);
    if (existing) return existing;
    const { rows } = await this.db.query(
      `INSERT INTO carts (id, user_id) VALUES (gen_random_uuid(), $1)
       ON CONFLICT (user_id) WHERE user_id IS NOT NULL AND status = 'active' DO NOTHING
       RETURNING ${COLUMNS}`,
      [userId]
    );
    return rows[0] || ((await this.findByUser(userId)) as Row);
  }

  async createGuestCart(): Promise<Row> {
    const { rows } = await this.db.query(`INSERT INTO carts (id) VALUES (gen_random_uuid()) RETURNING ${COLUMNS}`);
    return rows[0];
  }

  async listLines(cartId: string): Promise<CartLine[]> {
    const { rows } = await this.db.query(
      `SELECT product_id AS "productId", quantity FROM cart_items WHERE cart_id = $1 ORDER BY added_at`,
      [cartId]
    );
    return rows as CartLine[];
  }

  async setLine(cartId: string, productId: string, quantity: number): Promise<Row | null> {
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

  async removeLine(cartId: string, productId: string): Promise<void> {
    await this.db.query("DELETE FROM cart_items WHERE cart_id = $1 AND product_id = $2", [cartId, productId]);
    await this.touch(cartId);
  }

  async replaceLines(cartId: string, lines: readonly CartLine[]): Promise<void> {
    await this.db.query("DELETE FROM cart_items WHERE cart_id = $1", [cartId]);
    for (const line of lines) {
      await this.db.query("INSERT INTO cart_items (cart_id, product_id, quantity) VALUES ($1, $2, $3)", [
        cartId,
        line.productId,
        line.quantity
      ]);
    }
    await this.touch(cartId);
  }

  async remove(cartId: string): Promise<void> {
    await this.db.query("DELETE FROM carts WHERE id = $1", [cartId]);
  }

  async markConverted(cartId: string, orderId: string): Promise<void> {
    await this.db.query(
      "UPDATE carts SET status = 'converted', converted_order_id = $1, updated_at = NOW() WHERE id = $2",
      [orderId, cartId]
    );
  }

  async touch(cartId: string): Promise<void> {
    await this.db.query("UPDATE carts SET updated_at = NOW() WHERE id = $1", [cartId]);
  }

  /** Uzun süre dokunulmamış misafir sepetlerini temizler. */
  async purgeAbandonedGuestCarts(before: Date): Promise<number> {
    const result = await this.db.query(
      "DELETE FROM carts WHERE user_id IS NULL AND status = 'active' AND updated_at < $1",
      [before]
    );
    return result.rowCount ?? 0;
  }
}
