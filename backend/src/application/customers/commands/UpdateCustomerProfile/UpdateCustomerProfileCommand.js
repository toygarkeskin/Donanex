"use strict";

class UpdateCustomerProfileCommand {
  constructor(customerId, data) {
    this.customerId = customerId;
    this.data = data;
  }
}

module.exports = { UpdateCustomerProfileCommand };
