"use strict";

import type { Db } from "../pool";
import type { BrandRepository, Row } from "../../../../application/shared/contracts";

export class PgBrandRepository implements BrandRepository {
  private readonly db: Db;

  constructor(client: Db) {
    this.db = client;
  }

  /** Aynı kısa adla marka varsa hiçbir şey yapmaz ve null döner. */
  async create({ id, name, slug }: { id: string; name: string; slug: string }): Promise<Row | null> {
    const { rows } = await this.db.query(
      `INSERT INTO brands (id, slug, name)
       VALUES ($1, $2, $3)
       ON CONFLICT (slug) DO NOTHING
       RETURNING id, slug, name, verified`,
      [id, slug, name]
    );
    return rows[0] || null;
  }

  async findBySlug(slug: string): Promise<Row | null> {
    const { rows } = await this.db.query("SELECT id, slug, name, verified FROM brands WHERE slug = $1", [slug]);
    return rows[0] || null;
  }
}
