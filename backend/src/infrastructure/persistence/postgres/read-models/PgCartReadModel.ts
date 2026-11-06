"use strict";

import type { Pool } from "pg";
import type { CartLine } from "../../../../domain/ordering/Cart";
import type { CartProductRow, CartReadModel } from "../../../../application/shared/contracts";

export class PgCartReadModel implements CartReadModel {
  private readonly db: Pool;

  constructor(pool: Pool) {
    this.db = pool;
  }

  /** Giriş yapmışsa kendi sepeti, değilse çerezdeki misafir sepeti. */
  async findCartId({
    userId,
    guestCartId
  }: {
    userId?: string | null;
    guestCartId?: string | null;
  }): Promise<string | null> {
    if (userId) {
      const { rows } = await this.db.query("SELECT id FROM carts WHERE user_id = $1 AND status = 'active'", [userId]);
      return rows[0]?.id ?? null;
    }
    if (!guestCartId) return null;
    const { rows } = await this.db.query(
      "SELECT id FROM carts WHERE id = $1 AND user_id IS NULL AND status = 'active'",
      [guestCartId]
    );
    return rows[0]?.id ?? null;
  }

  /**
   * Sepet satırları ve ürünlerin GÜNCEL hali. Fiyat sepete değil ürüne bağlıdır;
   * fiyat değişince sepet de kendiliğinden güncellenir.
   */
  async getLines(cartId: string): Promise<{ lines: CartLine[]; products: CartProductRow[] }> {
    const { rows } = await this.db.query(
      `SELECT ci.product_id AS "productId", ci.quantity,
              p.name, p.slug, p.image_url AS "imageUrl", p.price_cents AS "priceCents",
              p.stock, p.status, p.store_id AS "storeId",
              s.name AS "storeName", s.slug AS "storeSlug", s.status AS "storeStatus"
       FROM cart_items ci
       JOIN products p ON p.id = ci.product_id
       JOIN stores s ON s.id = p.store_id
       WHERE ci.cart_id = $1
       ORDER BY ci.added_at`,
      [cartId]
    );

    return {
      lines: rows.map((row) => ({ productId: row.productId, quantity: row.quantity })),
      products: rows.map((row) => ({
        id: row.productId,
        name: row.name,
        slug: row.slug,
        imageUrl: row.imageUrl,
        priceCents: Number(row.priceCents),
        stock: row.stock,
        // Mağazası askıdaysa ürün de satın alınamaz.
        status: row.storeStatus === "active" ? row.status : "unavailable",
        storeId: row.storeId,
        storeName: row.storeName,
        storeSlug: row.storeSlug
      }))
    };
  }
}
