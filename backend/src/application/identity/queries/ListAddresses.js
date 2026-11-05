"use strict";

const { Query } = require("../../shared/cqrs/Message");

class ListAddressesQuery extends Query {
  constructor(input) {
    super();
    this.userId = input?.userId;
  }
}

class ListAddressesHandler {
  constructor({ userReadModel }) {
    this.readModel = userReadModel;
  }

  handle({ userId }) {
    return this.readModel.listAddresses(userId);
  }
}

module.exports = { ListAddressesQuery, ListAddressesHandler };
