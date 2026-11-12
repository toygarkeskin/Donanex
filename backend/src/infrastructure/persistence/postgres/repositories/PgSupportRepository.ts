"use strict";

import type { Db } from "../pool";
import type { Row, SupportRepository } from "../../../../application/shared/contracts";

const TICKET = `
  id, reference, user_id AS "userId", store_id AS "storeId", order_id AS "orderId",
  email, full_name AS "fullName", subject, message, status, priority, created_at AS "createdAt"`;

export class PgSupportRepository implements SupportRepository {
  private readonly db: Db;

  constructor(client: Db) {
    this.db = client;
  }

  async createTicket(ticket: Row): Promise<Row> {
    const { rows: reference } = await this.db.query("SELECT nextval('ticket_reference_seq') AS value");
    const { rows } = await this.db.query(
      `INSERT INTO support_tickets
         (id, reference, user_id, store_id, order_id, email, full_name, subject, message, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING ${TICKET}`,
      [
        ticket.id,
        `DT-${String(reference[0].value).padStart(6, "0")}`,
        ticket.userId,
        ticket.storeId,
        ticket.orderId,
        ticket.email,
        ticket.fullName,
        ticket.subject,
        ticket.message,
        ticket.status
      ]
    );
    return rows[0];
  }

  /** storeId verilirse yalnızca o mağazanın talebi bulunur. */
  async findTicket(ticketId: string, storeId: string | null = null): Promise<Row | null> {
    const { rows } = await this.db.query(
      `SELECT ${TICKET} FROM support_tickets
       WHERE id = $1 AND ($2::uuid IS NULL OR store_id = $2::uuid)`,
      [ticketId, storeId]
    );
    return rows[0] || null;
  }

  async addMessage({
    id,
    ticketId,
    authorUserId,
    body,
    isStaff
  }: {
    id: string;
    ticketId: string;
    authorUserId: string | null;
    body: string;
    isStaff: boolean;
  }): Promise<void> {
    await this.db.query(
      `INSERT INTO support_messages (id, ticket_id, author_user_id, body, is_staff)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, ticketId, authorUserId, body, isStaff]
    );
  }

  /** findTicket ile aynı kapsam, ama satırı kilitleyerek (ek sayısı sınırı için). */
  async lockTicket(ticketId: string, storeId: string | null = null): Promise<Row | null> {
    const { rows } = await this.db.query(
      `SELECT ${TICKET} FROM support_tickets
       WHERE id = $1 AND ($2::uuid IS NULL OR store_id = $2::uuid)
       FOR UPDATE`,
      [ticketId, storeId]
    );
    return rows[0] || null;
  }

  async countAttachments(ticketId: string): Promise<number> {
    const { rows } = await this.db.query(
      "SELECT COUNT(*)::int AS n FROM support_attachments WHERE ticket_id = $1",
      [ticketId]
    );
    return rows[0].n;
  }

  async addAttachment(ek: {
    id: string;
    ticketId: string;
    uploadedBy: string | null;
    isStaff: boolean;
    fileName: string;
    originalName: string;
    contentType: string;
    sizeBytes: number;
  }): Promise<Row> {
    const { rows } = await this.db.query(
      `INSERT INTO support_attachments
         (id, ticket_id, uploaded_by, is_staff, file_name, original_name, content_type, size_bytes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, original_name AS "originalName", content_type AS "contentType",
                 size_bytes AS "size", is_staff AS "isStaff", created_at AS "createdAt"`,
      [ek.id, ek.ticketId, ek.uploadedBy, ek.isStaff, ek.fileName, ek.originalName, ek.contentType, ek.sizeBytes]
    );
    return rows[0];
  }

  /**
   * Durumu — ve verilmişse önceliği — günceller.
   *
   * COALESCE bilinçli: öncelik null geldiğinde sütun KENDİ değerini alıyor,
   * yani dokunulmamış oluyor. Ayrı bir UPDATE yazılsaydı yalnızca durum
   * güncelleyen bir istek iki sorgu çalıştırır ya da önceliği sıfırlardı.
   */
  async setTicketStatus(ticketId: string, status: string, priority: string | null = null): Promise<Row | null> {
    const { rows } = await this.db.query(
      `UPDATE support_tickets
          SET status = $1,
              priority = COALESCE($2, priority),
              updated_at = NOW()
        WHERE id = $3
      RETURNING ${TICKET}`,
      [status, priority, ticketId]
    );
    return rows[0] || null;
  }
}
