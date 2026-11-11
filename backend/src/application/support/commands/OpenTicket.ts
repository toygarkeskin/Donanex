"use strict";

import { Command, type Handler } from "../../shared/cqrs/Message";
import { createTicket, type TicketInput } from "../../../domain/support/SupportTicket";
import { EventTypes, domainEvent } from "../../../domain/shared/DomainEvent";
import type { UseCaseContext } from "../../shared/authorize";
import type { IdGenerator, Row, UnitOfWork } from "../../shared/contracts";

export class OpenTicketCommand extends Command {
  readonly userId: string | null;
  readonly data: TicketInput | undefined;

  constructor(input?: { userId?: string | null; data?: TicketInput }) {
    super();
    this.userId = input?.userId ?? null;
    this.data = input?.data;
  }
}

/** Destek talebi. Kayıtsız kullanıcı da açabilir. */
export class OpenTicketHandler implements Handler<OpenTicketCommand, Row, UseCaseContext> {
  private readonly unitOfWork: UnitOfWork;
  private readonly ids: IdGenerator;

  constructor({ unitOfWork, ids }: { unitOfWork: UnitOfWork; ids: IdGenerator }) {
    this.unitOfWork = unitOfWork;
    this.ids = ids;
  }

  async handle({ userId, data }: OpenTicketCommand, context: UseCaseContext = {}): Promise<Row> {
    const ticket = createTicket(data);

    return this.unitOfWork.run(async (repos) => {
      const created = await repos.support.createTicket({ id: this.ids.uuid(), userId, ...ticket });
      // Olay kendi kendine yeterli: alıcı bilgisi içinde taşınır.
      await repos.outbox.add(
        domainEvent(EventTypes.SUPPORT_TICKET_OPENED, "support_ticket", created.id, {
          reference: created.reference,
          // Bildirimin düşeceği kutular: müşterinin hesabı ve talebin
          // muhatabı (mağaza varsa o, yoksa yönetim).
          userId: created.userId,
          storeId: created.storeId,
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
