"use strict";

import { Query, type Handler } from "../../shared/cqrs/Message";
import { NotFoundError } from "../../../domain/shared/errors";
import { requireUuid } from "../../../domain/shared/guards";
import { assertCan, type UseCaseContext } from "../../shared/authorize";
import type { Row, SupportReadModel } from "../../shared/contracts";

export type TicketScope = "mine" | "store" | "admin";

export class GetTicketQuery extends Query {
  readonly ticketId: string;
  readonly scope: TicketScope;
  readonly userId: string | null;
  readonly storeId: string | null;

  constructor(input?: { ticketId?: string; scope?: TicketScope; userId?: string | null; storeId?: string | null }) {
    super();
    this.ticketId = input?.ticketId as string;
    this.scope = input?.scope as TicketScope;
    this.userId = input?.userId ?? null;
    this.storeId = input?.storeId ?? null;
  }
}

export class GetTicketHandler implements Handler<GetTicketQuery, Row, UseCaseContext> {
  private readonly readModel: SupportReadModel;

  constructor({ supportReadModel }: { supportReadModel: SupportReadModel }) {
    this.readModel = supportReadModel;
  }

  async handle({ ticketId, scope, userId, storeId }: GetTicketQuery, context: UseCaseContext = {}): Promise<Row> {
    requireUuid(ticketId, "Talep numarası");
    if (scope === "store") assertCan(context, "support:read", { storeId });
    if (scope === "admin") assertCan(context, "support:read");

    // Sahiplik sorgunun parçası: kapsam dışı talep "yok" sayılır.
    const ticket = await this.readModel.get(ticketId, {
      userId: scope === "mine" ? userId : null,
      storeId: scope === "store" ? storeId : null
    });
    if (!ticket) throw new NotFoundError("Talep bulunamadı.");
    return ticket;
  }
}
