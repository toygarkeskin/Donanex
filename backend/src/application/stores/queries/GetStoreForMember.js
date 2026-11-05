"use strict";

const { Query } = require("../../shared/cqrs/Message");
const { NotFoundError } = require("../../../domain/shared/errors");
const { assertCan } = require("../../shared/authorize");

class GetStoreForMemberQuery extends Query {
  constructor(input) {
    super();
    this.storeId = input?.storeId;
  }
}

/** Mağaza paneli başlığı: yalnızca o mağazada yetkisi olan kişi görebilir. */
class GetStoreForMemberHandler {
  constructor({ storeReadModel }) {
    this.readModel = storeReadModel;
  }

  async handle({ storeId }, context = {}) {
    assertCan(context, "store:read", { storeId });
    const store = await this.readModel.getForMember(storeId);
    if (!store) throw new NotFoundError("Mağaza bulunamadı.");
    return store;
  }
}

module.exports = { GetStoreForMemberQuery, GetStoreForMemberHandler };
