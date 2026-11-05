"use strict";

const { Command } = require("../../shared/cqrs/Message");
const { UnauthorizedError, NotFoundError } = require("../../../domain/shared/errors");
const { assertPasswordStrength } = require("../../../domain/identity/User");
const { EventTypes, domainEvent } = require("../../../domain/shared/DomainEvent");
const { issueSsoSession } = require("../services/issueSession");

class ChangePasswordCommand extends Command {
  constructor(input) {
    super();
    this.userId = input?.userId;
    this.currentPassword = input?.currentPassword;
    this.newPassword = input?.newPassword;
  }
}

/**
 * Parola değiştirme. Mevcut parola sorulur ve işlem bitince kullanıcının
 * BAŞKA tüm oturumları ve yenileme jetonları iptal edilir; bu cihaza yeni bir
 * oturum verilir. Parolası çalınmış bir hesap böylece tek hamleyle kurtarılır.
 */
class ChangePasswordHandler {
  constructor({ unitOfWork, passwordHasher, opaqueTokens, cache, clock }) {
    this.unitOfWork = unitOfWork;
    this.passwordHasher = passwordHasher;
    this.opaqueTokens = opaqueTokens;
    this.cache = cache;
    this.clock = clock;
  }

  async handle({ userId, currentPassword, newPassword }, context = {}) {
    const user = await this.unitOfWork.run(({ users }) => users.findById(userId));
    if (!user) throw new NotFoundError("Hesap bulunamadı.");

    const ok =
      typeof currentPassword === "string" &&
      currentPassword.length <= 200 &&
      (await this.passwordHasher.verify(currentPassword, user.passwordHash));
    if (!ok) throw new UnauthorizedError("Mevcut parola hatalı.");

    assertPasswordStrength(newPassword, { email: user.email });
    const passwordHash = await this.passwordHasher.hash(newPassword);

    const result = await this.unitOfWork.run(async (repos) => {
      await repos.users.changePassword(user.id, passwordHash);
      await repos.authSessions.revokeAllForUser(user.id);
      await repos.oauth.revokeRefreshTokensForUser(user.id);

      const session = await issueSsoSession(repos, {
        userId: user.id,
        opaqueTokens: this.opaqueTokens,
        clock: this.clock,
        context
      });

      await repos.outbox.add(
        domainEvent(EventTypes.USER_PASSWORD_CHANGED, "user", user.id, {
          email: user.email,
          fullName: user.fullName
        })
      );
      await repos.audit.record({
        actorId: user.id,
        action: "user.password_changed",
        resourceType: "user",
        resourceId: user.id,
        context
      });
      return { session };
    });

    await this.cache.delete(`policy:${user.id}`);
    return result;
  }
}

module.exports = { ChangePasswordCommand, ChangePasswordHandler };
