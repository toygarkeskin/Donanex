"use strict";

class ChangeOrderStatusCommand {
  constructor(orderId, status) {
    this.orderId = orderId;
    this.status = status;
  }
}

module.exports = { ChangeOrderStatusCommand };
