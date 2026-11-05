"use strict";

const { Command } = require("../../shared/cqrs/Message");

class SignOutCommand extends Command {
  constructor(input) {
    super();
    this.ssoToken = input?.ssoToken ?? null;
    this.everywhere = input?.everywhere === true;
  }
}

/**
 * Çıkış. Oturum sunucu tarafında iptal edilir ve o oturuma bağlı tüm yenileme
 * jetonları geçersiz kılınır; çalınmış bir çerez ya da jeton artık işe yaramaz.
 */
class SignOutHandler {
  constructor({ unitOfWork, opaqueTokens }) {
    this.unitOfWork = unitOfWork;
    this.opaqueTokens = opaqueTokens;
  }

  async handle({ ssoToken, everywhere }, context = {}) {
    if (!ssoToken || !this.opaqueTokens.isWellFormed(ssoToken)) return { signedOut: false };

    return this.unitOfWork.run(async (repos) => {
      const session = await repos.authSessions.findByTokenHash(this.opaqueTokens.hash(ssoToken));
      if (!session) return { signedOut: false };

      if (everywhere) {
        await repos.authSessions.revokeAllForUser(session.userId);
        await repos.oauth.revokeRefreshTokensForUser(session.userId);
      } else {
        await repos.authSessions.revoke(session.id);
        await repos.oauth.revokeRefreshTokensForSession(session.id);
      }

      await repos.audit.record({
        actorId: session.userId,
        action: everywhere ? "user.signed_out_everywhere" : "user.signed_out",
        resourceType: "user",
        resourceId: session.userId,
        context
      });
      return { signedOut: true };
    });
  }
}

module.exports = { SignOutCommand, SignOutHandler };
