"use strict";

import { Command, type Handler } from "../../shared/cqrs/Message";
import { NotFoundError } from "../../../domain/shared/errors";
import { requireUuid } from "../../../domain/shared/guards";
import { createReply, type ReplyInput } from "../../../domain/support/SupportTicket";
import { EventTypes, domainEvent } from "../../../domain/shared/DomainEvent";
import { assertCan, type UseCaseContext } from "../../shared/authorize";
import type { IdGenerator, Row, UnitOfWork } from "../../shared/contracts";

export class ReplyToTicketCommand extends Command {
  readonly ticketId: string;
  readonly storeId: string | null;
  readonly data: ReplyInput | undefined;

  constructor(input?: { ticketId?: string; storeId?: string | null; data?: ReplyInput }) {
    super();
    this.ticketId = input?.ticketId as string;
    this.storeId = input?.storeId ?? null;
    this.data = input?.data;
  }
}

export interface ReplyResult {
  readonly ticket: Row | null;
  readonly emailQueued: boolean;
}

/**
 * Destek talebini yanıtlar ve durumunu günceller.
 * E-posta YALNIZCA yeni bir yanıt metni yazıldığında gönderilir; durum
 * değişikliği tek başına müşteriye posta göndermez.
 */
export class ReplyToTicketHandler implements Handler<ReplyToTicketCommand, ReplyResult, UseCaseContext> {
  private readonly unitOfWork: UnitOfWork;
  private readonly ids: IdGenerator;

  constructor({ unitOfWork, ids }: { unitOfWork: UnitOfWork; ids: IdGenerator }) {
    this.unitOfWork = unitOfWork;
    this.ids = ids;
  }

  async handle({ ticketId, storeId, data }: ReplyToTicketCommand, context: UseCaseContext = {}): Promise<ReplyResult> {
    requireUuid(ticketId, "Talep numarası");
    assertCan(context, "support:respond", storeId ? { storeId } : {});
    const reply = createReply(data);

    return this.unitOfWork.run(async (repos) => {
      const ticket = await repos.support.findTicket(ticketId, storeId);
      if (!ticket) throw new NotFoundError("Talep bulunamadı.");

      if (reply.body) {
        await repos.support.addMessage({
          id: this.ids.uuid(),
          ticketId,
          authorUserId: context.actorId ?? null,
          body: reply.body,
          isStaff: true
        });
      }
      const updated = await repos.support.setTicketStatus(ticketId, reply.status);

      if (reply.body) {
        await repos.outbox.add(
          domainEvent(EventTypes.SUPPORT_TICKET_ANSWERED, "support_ticket", ticketId, {
            reference: ticket.reference,
            email: ticket.email,
            fullName: ticket.fullName,
            subject: ticket.subject,
            body: reply.body
          })
        );
      }

      await repos.audit.record({
        actorId: context.actorId ?? null,
        action: "support.ticket_updated",
        resourceType: "support_ticket",
        resourceId: ticketId,
        metadata: { status: reply.status, replied: Boolean(reply.body) },
        context
      });

      return { ticket: updated, emailQueued: Boolean(reply.body) };
    });
  }
}
