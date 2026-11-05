"use strict";

const { UnauthorizedError, NotFoundError } = require("../../../../domain/shared/errors");
const { assertNewPassword } = require("../../../../domain/customers/Customer");
const { CUSTOMER_SESSION_TTL_MS, TOKEN_TYPES } = require("../../../identity/sessionPolicy");

/** Parola değişince diğer cihazlardaki oturumlar geçersiz olur; bu cihaza yeni belirteç verilir. */
class ChangeCustomerPasswordHandler {
  constructor({ unitOfWork, passwordHasher, tokenService }) {
    this.unitOfWork = unitOfWork;
    this.passwordHasher = passwordHasher;
    this.tokenService = tokenService;
  }

  async handle({ customerId, data }) {
    const { currentPassword, newPassword } = data || {};
    const password = assertNewPassword(newPassword);
    if (typeof currentPassword !== "string" || currentPassword.length > 128) {
      throw new UnauthorizedError("Mevcut şifre hatalı.");
    }

    const customer = await this.unitOfWork.run(({ customers }) => customers.findCredentialsById(customerId));
    if (!customer) throw new NotFoundError("Hesap bulunamadı.");

    const ok = await this.passwordHasher.verify(currentPassword, customer.passwordHash);
    if (!ok) throw new UnauthorizedError("Mevcut şifre hatalı.");

    const passwordHash = await this.passwordHasher.hash(password);
    const sessionVersion = await this.unitOfWork.run(({ customers }) =>
      customers.changePassword(customerId, passwordHash)
    );

    return {
      token: this.tokenService.issue(
        { typ: TOKEN_TYPES.CUSTOMER, customerId: String(customerId), sv: sessionVersion },
        CUSTOMER_SESSION_TTL_MS
      ),
      maxAgeSeconds: null
    };
  }
}

module.exports = { ChangeCustomerPasswordHandler };
