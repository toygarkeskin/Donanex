"use strict";

const { createAddress } = require("../../../../domain/customers/Customer");

class SaveCustomerAddressHandler {
  constructor({ unitOfWork }) {
    this.unitOfWork = unitOfWork;
  }

  async handle({ customerId, data }) {
    const address = createAddress(data);
    await this.unitOfWork.run(({ customers }) => customers.saveAddress(customerId, address));
  }
}

module.exports = { SaveCustomerAddressHandler };
