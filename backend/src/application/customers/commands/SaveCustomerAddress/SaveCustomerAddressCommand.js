"use strict";

class SaveCustomerAddressCommand {
  constructor(customerId, data) {
    this.customerId = customerId;
    this.data = data;
  }
}

module.exports = { SaveCustomerAddressCommand };
