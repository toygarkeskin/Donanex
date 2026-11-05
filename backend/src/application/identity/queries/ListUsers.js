"use strict";

const { Query } = require("../../shared/cqrs/Message");

class ListUsersQuery extends Query {
  constructor(filters = {}) {
    super();
    this.filters = filters;
  }
}

class ListUsersHandler {
  constructor({ userReadModel }) {
    this.readModel = userReadModel;
  }

  handle({ filters }) {
    const page = Number.isInteger(Number(filters.page)) && Number(filters.page) > 0 ? Number(filters.page) : 1;
    const pageSize = Math.min(100, Math.max(1, Number(filters.pageSize) || 20));
    return this.readModel.listForAdmin({
      search: typeof filters.q === "string" ? filters.q.trim().slice(0, 100) : "",
      role: typeof filters.role === "string" ? filters.role : null,
      status: typeof filters.status === "string" ? filters.status : null,
      limit: pageSize,
      offset: (page - 1) * pageSize,
      page,
      pageSize
    });
  }
}

module.exports = { ListUsersQuery, ListUsersHandler };
