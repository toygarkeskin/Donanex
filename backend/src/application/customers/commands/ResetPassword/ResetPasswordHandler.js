"use strict";

const { ValidationError } = require("../../../../domain/shared/errors");
const { assertNewPassword } = require("../../../../domain/customers/Customer");

const INVALID = "Sıfırlama bağlantısı geçersiz veya süresi dolmuş.";

/** Belirteç tek kullanımlıktır; başarıda müşterinin tüm oturumları sonlanır. */
class ResetPasswordHandler {
  constructor({ unitOfWork, opaqueTokens, passwordHasher }) {
    this.unitOfWork = unitOfWork;
    this.opaqueTokens = opaqueTokens;
    this.passwordHasher = passwordHasher;
  }

  async handle({ token, newPassword }) {
    const password = assertNewPassword(newPassword);
    if (!this.opaqueTokens.isWellFormed(token)) throw new ValidationError(INVALID);

    const passwordHash = await this.passwordHasher.hash(password);

    await this.unitOfWork.run(async ({ customers }) => {
      const customerId = await customers.consumeResetToken(this.opaqueTokens.hash(token));
      if (!customerId) throw new ValidationError(INVALID);
      await customers.changePassword(customerId, passwordHash);
    });
  }
}

module.exports = { ResetPasswordHandler };
