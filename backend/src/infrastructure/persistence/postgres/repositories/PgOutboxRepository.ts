"use strict";

import type { Db } from "../pool";
import type { OutboxRepository, Row } from "../../../../application/shared/contracts";
import type { DomainEventShape } from "../../../../domain/shared/DomainEvent";

/**
 * Transactional outbox'ın yazma tarafı. Olay, onu doğuran veriyle aynı
 * transaction içinde yazılır; worker ayrıca okuyup kuyruğa aktarır.
 */
export class PgOutboxRepository implements OutboxRepository {
  private readonly db: Db;

  constructor(client: Db) {
    this.db = client;
  }

  async add(event: DomainEventShape): Promise<void> {
    await this.db.query(
      `INSERT INTO outbox_messages (type, aggregate_type, aggregate_id, payload, occurred_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [event.type, event.aggregateType, event.aggregateId, event.payload, event.occurredAt]
    );
  }

  /** Yayınlanmayı bekleyen olayları kilitler (SKIP LOCKED: tek worker alır). */
  async claimPending(limit: number): Promise<Row[]> {
    const { rows } = await this.db.query(
      `SELECT id, type, aggregate_type AS "aggregateType", aggregate_id AS "aggregateId",
              payload, occurred_at AS "occurredAt", attempts
       FROM outbox_messages
       WHERE published_at IS NULL AND attempts < 10
       ORDER BY id
       LIMIT $1
       FOR UPDATE SKIP LOCKED`,
      [limit]
    );
    return rows;
  }

  async markPublished(ids: readonly (string | number)[]): Promise<void> {
    if (!ids.length) return;
    await this.db.query("UPDATE outbox_messages SET published_at = NOW() WHERE id = ANY($1::bigint[])", [ids]);
  }

  async markFailed(id: string | number, error: unknown): Promise<void> {
    await this.db.query("UPDATE outbox_messages SET attempts = attempts + 1, last_error = $1 WHERE id = $2", [
      String(error).slice(0, 2000),
      id
    ]);
  }
}
