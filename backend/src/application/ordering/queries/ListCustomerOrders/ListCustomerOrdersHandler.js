"use strict";

const { canCustomerCancel } = require("../../../../domain/ordering/OrderStatus");

class ListCustomerOrdersHandler {
  constructor({ orderReadModel }) {
    this.readModel = orderReadModel;
  }

  async handle({ customerId }) {
    const orders = await this.readModel.listForCustomer(customerId);
    return orders.map((order) => ({ ...order, canCancel: canCustomerCancel(order.status) }));
  }
}

module.exports = { ListCustomerOrdersHandler };
