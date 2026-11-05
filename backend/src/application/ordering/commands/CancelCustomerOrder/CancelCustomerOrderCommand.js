"use strict";

class CancelCustomerOrderCommand {
  constructor(customerId, orderId) {
    this.customerId = customerId;
    this.orderId = orderId;
  }
}

module.exports = { CancelCustomerOrderCommand };
