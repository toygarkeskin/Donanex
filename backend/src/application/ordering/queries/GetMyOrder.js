"use strict";

const { Query } = require("../../shared/cqrs/Message");
const { NotFoundError } = require("../../../domain/shared/errors");
const { requireUuid } = require("../../../domain/shared/guards");

class GetMyOrderQuery extends Query {
  constructor(input) {
    super();
    this.userId = input?.userId;
    this.orderId = input?.orderId;
  }
}

class GetMyOrderHandler {
  constructor({ orderReadModel }) {
    this.readModel = orderReadModel;
  }

  async handle({ userId, orderId }) {
    requireUuid(orderId, "Sipariş numarası");
    // Kullanıcı kimliği sorgunun parçası: başkasının siparişi görülemez.
    const order = await this.readModel.getForUser(orderId, userId);
    if (!order) throw new NotFoundError("Sipariş bulunamadı.");
    return order;
  }
}

module.exports = { GetMyOrderQuery, GetMyOrderHandler };
