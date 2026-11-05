"use strict";

const { Query } = require("../../shared/cqrs/Message");
const { NotFoundError } = require("../../../domain/shared/errors");
const { requireUuid } = require("../../../domain/shared/guards");
const { assertCan } = require("../../shared/authorize");

class GetStoreOrderQuery extends Query {
  constructor(input) {
    super();
    this.storeId = input?.storeId;
    this.packageId = input?.packageId;
  }
}

class GetStoreOrderHandler {
  constructor({ orderReadModel }) {
    this.readModel = orderReadModel;
  }

  async handle({ storeId, packageId }, context = {}) {
    requireUuid(storeId, "Mağaza numarası");
    requireUuid(packageId, "Paket numarası");
    assertCan(context, "order:read", { storeId });

    const pkg = await this.readModel.getForStore(packageId, storeId);
    if (!pkg) throw new NotFoundError("Paket bulunamadı.");
    return pkg;
  }
}

module.exports = { GetStoreOrderQuery, GetStoreOrderHandler };
