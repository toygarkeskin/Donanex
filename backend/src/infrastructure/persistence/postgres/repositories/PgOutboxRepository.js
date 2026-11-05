"use strict";

/**
 * Transactional outbox'ın yazma tarafı. Olay, onu doğuran veriyle aynı
 * transaction içinde yazılır; worker ayrıca okuyup kuyruğa aktarır.
 */
class PgOutboxRepository {
  constructor(client) {
    this.db = client;
  }

  async add(event) {
    await this.db.query(
      `INSERT INTO outbox_messages (type, aggregate_type, aggregate_id, payload, occurred_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [event.type, event.aggregateType, event.aggregateId, event.payload, event.occurredAt]
    );
  }

  /** Yayınlanmayı bekleyen olayları kilitler (SKIP LOCKED: tek worker alır). */
  async claimPending(limit) {
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

  async markPublished(ids) {
    if (!ids.length) return;
    await this.db.query("UPDATE outbox_messages SET published_at = NOW() WHERE id = ANY($1::bigint[])", [ids]);
  }

  async markFailed(id, error) {
    await this.db.query(
      "UPDATE outbox_messages SET attempts = attempts + 1, last_error = $1 WHERE id = $2",
      [String(error).slice(0, 2000), id]
    );
  }
}

module.exports = { PgOutboxRepository };
