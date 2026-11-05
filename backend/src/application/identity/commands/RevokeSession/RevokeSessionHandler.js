"use strict";

/** Çıkış: belirteç süresi dolana kadar kara listeye alınır, çalınmış çerez de işe yaramaz. */
class RevokeSessionHandler {
  constructor({ unitOfWork, tokenService }) {
    this.unitOfWork = unitOfWork;
    this.tokenService = tokenService;
  }

  async handle({ token, type }) {
    const payload = this.tokenService.verify(token, type);
    if (!payload) return;

    await this.unitOfWork.run(async ({ sessions }) => {
      await sessions.revoke(payload.jti, new Date(payload.expiresAt));
      await sessions.purgeExpired();
    });
  }
}

module.exports = { RevokeSessionHandler };
