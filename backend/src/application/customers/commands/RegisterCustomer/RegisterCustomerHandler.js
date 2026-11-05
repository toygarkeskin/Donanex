"use strict";

const { ConflictError } = require("../../../../domain/shared/errors");
const { validateRegistration } = require("../../../../domain/customers/Customer");

class RegisterCustomerHandler {
  constructor({ unitOfWork, passwordHasher }) {
    this.unitOfWork = unitOfWork;
    this.passwordHasher = passwordHasher;
  }

  async handle({ data }) {
    const { name, email, password } = validateRegistration(data);
    const passwordHash = await this.passwordHasher.hash(password);

    const created = await this.unitOfWork.run(({ customers }) =>
      customers.addIfEmailFree({ name, email, passwordHash })
    );
    if (!created) throw new ConflictError("Bu e-posta zaten kayıtlı.");
    return created;
  }
}

module.exports = { RegisterCustomerHandler };
