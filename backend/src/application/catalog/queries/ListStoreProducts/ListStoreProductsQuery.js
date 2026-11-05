"use strict";

class ListStoreProductsQuery {
  /** @param {{search?:string, categories?:string, ids?:string}} filters ham sorgu parametreleri */
  constructor(filters = {}) {
    this.filters = filters;
  }
}

module.exports = { ListStoreProductsQuery };
