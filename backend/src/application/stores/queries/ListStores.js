"use strict";

const { Query } = require("../../shared/cqrs/Message");

class ListStoresQuery extends Query {
  constructor(filters = {}) {
    super();
    this.filters = filters;
  }
}

/** Vitrindeki mağaza listesi — yalnızca onaylı ve aktif mağazalar. */
class ListStoresHandler {
  constructor({ storeReadModel }) {
    this.readModel = storeReadModel;
  }

  handle({ filters }) {
    return this.readModel.listPublic({
      search: typeof filters.q === "string" ? filters.q.trim().slice(0, 100) : "",
      limit: Math.min(100, Math.max(1, Number(filters.pageSize) || 50))
    });
  }
}

module.exports = { ListStoresQuery, ListStoresHandler };
