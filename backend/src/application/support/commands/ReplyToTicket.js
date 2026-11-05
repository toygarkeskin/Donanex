"use strict";

const { Command } = require("../../shared/cqrs/Message");
const { NotFoundError } = require("../../../domain/shared/errors");
const { requireUuid } = require("../../../domain/shared/guards");
const { createReply } = require("../../../domain/support/SupportTicket");
const { EventTypes, domainEvent } = require("../../../domain/shared/DomainEvent");
const { assertCan } = require("../../shared/authorize");

class ReplyToTicketCommand extends Command {
  constructor(input) {
    super();
    this.ticketId = input?.ticketId;
    this.storeId = input?.storeId ?? null;
    this.data = input?.data;
  }
}

/**
 * Destek talebini yanıtlar ve durumunu günceller.
 * E-posta YALNIZCA yeni bir yanıt metni yazıldığında gönderilir; durum
 * değişikliği tek başına müşteriye posta göndermez.
 */
class ReplyToTicketHandler {
  constructor({ unitOfWork, ids }) {
    this.unitOfWork = unitOfWork;
    this.ids = ids;
  }

  async handle({ ticketId, storeId, data }, context = {}) {
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

module.exports = { ReplyToTicketCommand, ReplyToTicketHandler };
