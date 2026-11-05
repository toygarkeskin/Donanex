"use strict";

const { Query } = require("../../shared/cqrs/Message");
const { requireUuid } = require("../../../domain/shared/guards");
const { assertCan } = require("../../shared/authorize");

class ListStoreProductsQuery extends Query {
  constructor(input) {
    super();
    this.storeId = input?.storeId;
    this.filters = input?.filters || {};
  }
}

/** Mağaza panelindeki ürün listesi: taslak ve arşivli ürünler de görünür. */
class ListStoreProductsHandler {
  constructor({ catalogReadModel }) {
    this.readModel = catalogReadModel;
  }

  handle({ storeId, filters }, context = {}) {
    requireUuid(storeId, "Mağaza numarası");
    assertCan(context, "catalog:product:read", { storeId });

    const page = Math.max(1, Number(filters.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(filters.pageSize) || 20));
    return this.readModel.listStoreProducts(storeId, {
      search: typeof filters.q === "string" ? filters.q.trim().slice(0, 100) : "",
      status: typeof filters.status === "string" ? filters.status : null,
      limit: pageSize,
      offset: (page - 1) * pageSize,
      page,
      pageSize
    });
  }
}

module.exports = { ListStoreProductsQuery, ListStoreProductsHandler };
