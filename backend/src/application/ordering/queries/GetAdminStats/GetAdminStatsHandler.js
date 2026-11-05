"use strict";

class GetAdminStatsHandler {
  constructor({ orderReadModel }) {
    this.readModel = orderReadModel;
  }

  handle() {
    return this.readModel.getStats();
  }
}

module.exports = { GetAdminStatsHandler };
