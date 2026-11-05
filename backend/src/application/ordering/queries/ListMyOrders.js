"use strict";

const { Query } = require("../../shared/cqrs/Message");

class ListMyOrdersQuery extends Query {
  constructor(input) {
    super();
    this.userId = input?.userId;
    this.filters = input?.filters || {};
  }
}

class ListMyOrdersHandler {
  constructor({ orderReadModel }) {
    this.readModel = orderReadModel;
  }

  handle({ userId, filters }) {
    const page = Math.max(1, Number(filters.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(filters.pageSize) || 10));
    return this.readModel.listForUser(userId, { limit: pageSize, offset: (page - 1) * pageSize, page, pageSize });
  }
}

module.exports = { ListMyOrdersQuery, ListMyOrdersHandler };
