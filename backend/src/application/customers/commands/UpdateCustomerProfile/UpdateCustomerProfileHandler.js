"use strict";

const { assertName } = require("../../../../domain/customers/Customer");

class UpdateCustomerProfileHandler {
  constructor({ unitOfWork }) {
    this.unitOfWork = unitOfWork;
  }

  async handle({ customerId, data }) {
    const name = assertName(data?.name);
    await this.unitOfWork.run(({ customers }) => customers.updateName(customerId, name));
    return { name };
  }
}

module.exports = { UpdateCustomerProfileHandler };
