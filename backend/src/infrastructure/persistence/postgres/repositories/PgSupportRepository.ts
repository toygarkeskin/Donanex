"use strict";

import type { Db } from "../pool";
import type { Row, SupportRepository } from "../../../../application/shared/contracts";

const TICKET = `
  id, reference, user_id AS "userId", store_id AS "storeId", order_id AS "orderId",
  email, full_name AS "fullName", subject, message, status, created_at AS "createdAt"`;

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

  async setTicketStatus(ticketId: string, status: string): Promise<Row | null> {
    const { rows } = await this.db.query(
      `UPDATE support_tickets SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING ${TICKET}`,
      [status, ticketId]
    );
    return rows[0] || null;
  }
}
