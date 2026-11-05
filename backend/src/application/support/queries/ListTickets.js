"use strict";

const { Query } = require("../../shared/cqrs/Message");
const { assertCan } = require("../../shared/authorize");

class ListTicketsQuery extends Query {
  /** @param {{scope:"mine"|"store"|"admin", userId?, storeId?, filters?}} input */
  constructor(input) {
    super();
    this.scope = input?.scope;
    this.userId = input?.userId ?? null;
    this.storeId = input?.storeId ?? null;
    this.filters = input?.filters || {};
  }
}

class ListTicketsHandler {
  constructor({ supportReadModel }) {
    this.readModel = supportReadModel;
  }

  handle({ scope, userId, storeId, filters }, context = {}) {
    const page = Math.max(1, Number(filters.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(filters.pageSize) || 20));
    const paging = { limit: pageSize, offset: (page - 1) * pageSize, page, pageSize };
    const status = typeof filters.status === "string" ? filters.status : null;

    if (scope === "store") {
      assertCan(context, "support:read", { storeId });
      return this.readModel.listForStore(storeId, { ...paging, status });
    }
    if (scope === "admin") {
      assertCan(context, "support:read");
      return this.readModel.listForAdmin({ ...paging, status });
    }
    return this.readModel.listForUser(userId, paging);
  }
}

module.exports = { ListTicketsQuery, ListTicketsHandler };
