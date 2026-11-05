"use strict";

class ListAdminOrdersQuery {
  /** @param {{q?:string,status?:string,from?:string,to?:string,page?:string,pageSize?:string}} filters */
  constructor(filters = {}) {
    this.filters = filters;
  }
}

module.exports = { ListAdminOrdersQuery };
