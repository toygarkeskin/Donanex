"use strict";

const { Command } = require("../../shared/cqrs/Message");
const { ValidationError } = require("../../../domain/shared/errors");

class VerifyEmailCommand extends Command {
  constructor(input) {
    super();
    this.token = input?.token;
  }
}

class VerifyEmailHandler {
  constructor({ unitOfWork, opaqueTokens, clock }) {
    this.unitOfWork = unitOfWork;
    this.opaqueTokens = opaqueTokens;
    this.clock = clock;
  }

  async handle({ token }) {
    if (!this.opaqueTokens.isWellFormed(token)) {
      throw new ValidationError("Doğrulama bağlantısı geçersiz veya süresi dolmuş.");
    }

    return this.unitOfWork.run(async (repos) => {
      const claimed = await repos.verificationTokens.consume(
        "email_verification",
        this.opaqueTokens.hash(token),
        this.clock.now()
      );
      if (!claimed) throw new ValidationError("Doğrulama bağlantısı geçersiz veya süresi dolmuş.");
      await repos.users.markEmailVerified(claimed.userId);
      return { verified: true };
    });
  }
}

module.exports = { VerifyEmailCommand, VerifyEmailHandler };
