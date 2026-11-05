"use strict";

class ListSupportRequestsHandler {
  constructor({ supportReadModel }) {
    this.readModel = supportReadModel;
  }

  handle({ limit }) {
    return this.readModel.list(limit);
  }
}

module.exports = { ListSupportRequestsHandler };
