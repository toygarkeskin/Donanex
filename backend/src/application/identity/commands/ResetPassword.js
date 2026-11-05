"use strict";

const { Command } = require("../../shared/cqrs/Message");
const { ValidationError } = require("../../../domain/shared/errors");
const { assertPasswordStrength } = require("../../../domain/identity/User");

const INVALID = "Sıfırlama bağlantısı geçersiz veya süresi dolmuş.";

class ResetPasswordCommand extends Command {
  constructor(input) {
    super();
    this.token = input?.token;
    this.newPassword = input?.newPassword;
  }
}

/** Jeton tek kullanımlıktır; başarıda kullanıcının tüm oturumları sonlanır. */
class ResetPasswordHandler {
  constructor({ unitOfWork, passwordHasher, opaqueTokens, cache, clock }) {
    this.unitOfWork = unitOfWork;
    this.passwordHasher = passwordHasher;
    this.opaqueTokens = opaqueTokens;
    this.cache = cache;
    this.clock = clock;
  }

  async handle({ token, newPassword }, context = {}) {
    if (!this.opaqueTokens.isWellFormed(token)) throw new ValidationError(INVALID);
    assertPasswordStrength(newPassword);
    const passwordHash = await this.passwordHasher.hash(newPassword);

    const userId = await this.unitOfWork.run(async (repos) => {
      const claimed = await repos.verificationTokens.consume(
        "password_reset",
        this.opaqueTokens.hash(token),
        this.clock.now()
      );
      if (!claimed) throw new ValidationError(INVALID);

      await repos.users.changePassword(claimed.userId, passwordHash);
      await repos.authSessions.revokeAllForUser(claimed.userId);
      await repos.oauth.revokeRefreshTokensForUser(claimed.userId);
      await repos.audit.record({
        actorId: claimed.userId,
        action: "user.password_reset",
        resourceType: "user",
        resourceId: claimed.userId,
        context
      });
      return claimed.userId;
    });

    await this.cache.delete(`policy:${userId}`);
    return { reset: true };
  }
}

module.exports = { ResetPasswordCommand, ResetPasswordHandler };
