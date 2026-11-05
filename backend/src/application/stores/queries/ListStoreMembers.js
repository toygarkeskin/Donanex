"use strict";

const { Query } = require("../../shared/cqrs/Message");
const { assertCan } = require("../../shared/authorize");

class ListStoreMembersQuery extends Query {
  constructor(input) {
    super();
    this.storeId = input?.storeId;
  }
}

class ListStoreMembersHandler {
  constructor({ storeReadModel }) {
    this.readModel = storeReadModel;
  }

  handle({ storeId }, context = {}) {
    assertCan(context, "store:member:manage", { storeId });
    return this.readModel.listMembers(storeId);
  }
}

module.exports = { ListStoreMembersQuery, ListStoreMembersHandler };
