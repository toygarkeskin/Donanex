"use strict";

class UpdateOrderShippingCommand {
  constructor(orderId, data) {
    this.orderId = orderId;
    this.data = data;
  }
}

module.exports = { UpdateOrderShippingCommand };
