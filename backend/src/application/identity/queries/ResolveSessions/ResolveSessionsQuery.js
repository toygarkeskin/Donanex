"use strict";

class ResolveSessionsQuery {
  constructor(adminToken, customerToken) {
    this.adminToken = adminToken;
    this.customerToken = customerToken;
  }
}

module.exports = { ResolveSessionsQuery };
