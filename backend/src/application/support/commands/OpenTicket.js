"use strict";

const { Command } = require("../../shared/cqrs/Message");
const { createTicket } = require("../../../domain/support/SupportTicket");
const { EventTypes, domainEvent } = require("../../../domain/shared/DomainEvent");

class OpenTicketCommand extends Command {
  constructor(input) {
    super();
    this.userId = input?.userId ?? null;
    this.data = input?.data;
  }
}

/** Destek talebi. Kayıtsız kullanıcı da açabilir. */
class OpenTicketHandler {
  constructor({ unitOfWork, ids }) {
    this.unitOfWork = unitOfWork;
    this.ids = ids;
  }

  async handle({ userId, data }, context = {}) {
    const ticket = createTicket(data);

    return this.unitOfWork.run(async (repos) => {
      const created = await repos.support.createTicket({ id: this.ids.uuid(), userId, ...ticket });
      await repos.outbox.add(
        domainEvent(EventTypes.SUPPORT_TICKET_OPENED, "support_ticket", created.id, {
          reference: created.reference,
          email: ticket.email,
          fullName: ticket.fullName,
          subject: ticket.subject
        })
      );
      await repos.audit.record({
        actorId: userId,
        action: "support.ticket_opened",
        resourceType: "support_ticket",
        resourceId: created.id,
        context
      });
      return created;
    });
  }
}

module.exports = { OpenTicketCommand, OpenTicketHandler };
