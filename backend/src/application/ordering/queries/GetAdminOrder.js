"use strict";

const { Query } = require("../../shared/cqrs/Message");
const { NotFoundError } = require("../../../domain/shared/errors");
const { requireUuid } = require("../../../domain/shared/guards");
const { assertCan } = require("../../shared/authorize");

class GetAdminOrderQuery extends Query {
  constructor(input) {
    super();
    this.orderId = input?.orderId;
  }
}

class GetAdminOrderHandler {
  constructor({ orderReadModel }) {
    this.readModel = orderReadModel;
  }

  async handle({ orderId }, context = {}) {
    assertCan(context, "order:read");
    requireUuid(orderId, "Sipariş numarası");
    const order = await this.readModel.getForAdmin(orderId);
    if (!order) throw new NotFoundError("Sipariş bulunamadı.");
    return order;
  }
}

module.exports = { GetAdminOrderQuery, GetAdminOrderHandler };
