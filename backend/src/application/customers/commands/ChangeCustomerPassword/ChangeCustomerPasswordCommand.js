"use strict";

class ChangeCustomerPasswordCommand {
  constructor(customerId, data) {
    this.customerId = customerId;
    this.data = data;
  }
}

module.exports = { ChangeCustomerPasswordCommand };
