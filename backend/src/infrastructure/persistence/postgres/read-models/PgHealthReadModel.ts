"use strict";

import type { Pool } from "pg";
import type { HealthReadModel } from "../../../../application/shared/contracts";

export class PgHealthReadModel implements HealthReadModel {
  private readonly db: Pool;

  constructor(pool: Pool) {
    this.db = pool;
  }

  async ping(): Promise<void> {
    await this.db.query("SELECT 1");
  }
}
