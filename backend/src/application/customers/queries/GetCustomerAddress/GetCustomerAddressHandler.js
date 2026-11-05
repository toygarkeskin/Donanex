"use strict";

class GetCustomerAddressHandler {
  constructor({ customerReadModel }) {
    this.readModel = customerReadModel;
  }

  async handle({ customerId }) {
    const address = await this.readModel.getAddress(customerId);
    return address || { fullName: "", phone: "", address: "" };
  }
}

module.exports = { GetCustomerAddressHandler };
