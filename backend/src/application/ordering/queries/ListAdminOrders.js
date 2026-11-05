"use strict";

const { Query } = require("../../shared/cqrs/Message");
const { isOrderStatus } = require("../../../domain/ordering/OrderStatus");
const { assertCan } = require("../../shared/authorize");

class ListAdminOrdersQuery extends Query {
  constructor(filters = {}) {
    super();
    this.filters = filters;
  }
}

class ListAdminOrdersHandler {
  constructor({ orderReadModel }) {
    this.readModel = orderReadModel;
  }

  handle({ filters }, context = {}) {
    assertCan(context, "order:read");

    const page = Math.max(1, Number(filters.page) || 1);
    const pageSize = Math.min(1000, Math.max(1, Number(filters.pageSize) || 20));
    const date = (value) => (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null);

    return this.readModel.listForAdmin({
      search: typeof filters.q === "string" ? filters.q.trim().slice(0, 100) : "",
      status: isOrderStatus(filters.status) ? filters.status : null,
      from: date(filters.from),
      to: date(filters.to),
      limit: pageSize,
      offset: (page - 1) * pageSize,
      page,
      pageSize
    });
  }
}

module.exports = { ListAdminOrdersQuery, ListAdminOrdersHandler };
