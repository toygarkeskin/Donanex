"use strict";

const { Query } = require("../../shared/cqrs/Message");
const { assertCan } = require("../../shared/authorize");

class GetDashboardQuery extends Query {
  constructor(input) {
    super();
    this.scope = input?.scope;
    this.storeId = input?.storeId ?? null;
  }
}

/** Panel özetleri. Mağaza sahibi yalnızca kendi mağazasının sayılarını görür. */
class GetDashboardHandler {
  constructor({ dashboardReadModel }) {
    this.readModel = dashboardReadModel;
  }

  handle({ scope, storeId }, context = {}) {
    if (scope === "store") {
      assertCan(context, "order:read", { storeId });
      return this.readModel.storeSummary(storeId);
    }
    assertCan(context, "system:settings");
    return this.readModel.adminSummary();
  }
}

module.exports = { GetDashboardQuery, GetDashboardHandler };
