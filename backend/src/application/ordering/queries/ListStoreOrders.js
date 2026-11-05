"use strict";

const { Query } = require("../../shared/cqrs/Message");
const { requireUuid } = require("../../../domain/shared/guards");
const { isPackageStatus } = require("../../../domain/ordering/OrderStatus");
const { assertCan } = require("../../shared/authorize");

class ListStoreOrdersQuery extends Query {
  constructor(input) {
    super();
    this.storeId = input?.storeId;
    this.filters = input?.filters || {};
  }
}

/** Mağaza paneli: yalnızca o mağazaya düşen paketler listelenir. */
class ListStoreOrdersHandler {
  constructor({ orderReadModel }) {
    this.readModel = orderReadModel;
  }

  handle({ storeId, filters }, context = {}) {
    requireUuid(storeId, "Mağaza numarası");
    assertCan(context, "order:read", { storeId });

    const page = Math.max(1, Number(filters.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(filters.pageSize) || 20));
    const date = (value) => (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null);

    return this.readModel.listForStore(storeId, {
      search: typeof filters.q === "string" ? filters.q.trim().slice(0, 100) : "",
      status: isPackageStatus(filters.status) ? filters.status : null,
      from: date(filters.from),
      to: date(filters.to),
      limit: pageSize,
      offset: (page - 1) * pageSize,
      page,
      pageSize
    });
  }
}

module.exports = { ListStoreOrdersQuery, ListStoreOrdersHandler };
