"use strict";

const { Query } = require("../../shared/cqrs/Message");
const { assertCan } = require("../../shared/authorize");

class ListStoresForAdminQuery extends Query {
  constructor(filters = {}) {
    super();
    this.filters = filters;
  }
}

class ListStoresForAdminHandler {
  constructor({ storeReadModel }) {
    this.readModel = storeReadModel;
  }

  handle({ filters }, context = {}) {
    assertCan(context, "store:approve");
    const page = Math.max(1, Number(filters.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(filters.pageSize) || 20));
    return this.readModel.listForAdmin({
      search: typeof filters.q === "string" ? filters.q.trim().slice(0, 100) : "",
      status: typeof filters.status === "string" ? filters.status : null,
      limit: pageSize,
      offset: (page - 1) * pageSize,
      page,
      pageSize
    });
  }
}

module.exports = { ListStoresForAdminQuery, ListStoresForAdminHandler };
