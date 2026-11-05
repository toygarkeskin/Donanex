"use strict";

const { Query } = require("../../shared/cqrs/Message");
const { NotFoundError } = require("../../../domain/shared/errors");
const { requireUuid } = require("../../../domain/shared/guards");
const { assertCan } = require("../../shared/authorize");

class GetTicketQuery extends Query {
  constructor(input) {
    super();
    this.ticketId = input?.ticketId;
    this.scope = input?.scope;
    this.userId = input?.userId ?? null;
    this.storeId = input?.storeId ?? null;
  }
}

class GetTicketHandler {
  constructor({ supportReadModel }) {
    this.readModel = supportReadModel;
  }

  async handle({ ticketId, scope, userId, storeId }, context = {}) {
    requireUuid(ticketId, "Talep numarası");
    if (scope === "store") assertCan(context, "support:read", { storeId });
    if (scope === "admin") assertCan(context, "support:read");

    const ticket = await this.readModel.get(ticketId, {
      userId: scope === "mine" ? userId : null,
      storeId: scope === "store" ? storeId : null
    });
    if (!ticket) throw new NotFoundError("Talep bulunamadı.");
    return ticket;
  }
}

module.exports = { GetTicketQuery, GetTicketHandler };
