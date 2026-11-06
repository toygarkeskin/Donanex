"use strict";

import type { Db } from "../pool";
import type { AuditRepository, Row } from "../../../../application/shared/contracts";

/**
 * Denetim kaydı: kim, ne zaman, neyi değiştirdi.
 * Kaydın kendisi iş transaction'ının parçasıdır; işlem geri alınırsa
 * denetim kaydı da geri alınır ve gerçekleşmemiş bir işlem günlükte kalmaz.
 */
export class PgAuditRepository implements AuditRepository {
  private readonly db: Db;

  constructor(client: Db) {
    this.db = client;
  }

  async record({
    actorId = null,
    action,
    resourceType,
    resourceId = null,
    metadata = {},
    context = {}
  }: {
    actorId?: string | null;
    action: string;
    resourceType: string;
    resourceId?: string | null;
    metadata?: Row;
    context?: Row;
  }): Promise<void> {
    await this.db.query(
      `INSERT INTO audit_log (actor_user_id, action, resource_type, resource_id, metadata, ip, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        actorId ?? context.actorId ?? null,
        action,
        resourceType,
        resourceId ? String(resourceId) : null,
        metadata,
        context.ip ?? null,
        context.userAgent ? String(context.userAgent).slice(0, 300) : null
      ]
    );
  }
}
