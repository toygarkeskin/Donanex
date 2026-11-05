"use strict";

const { Command } = require("../../shared/cqrs/Message");

class RevokeTokenCommand extends Command {
  constructor(input) {
    super();
    this.token = input?.token;
  }
}

/**
 * RFC 7009 jeton iptali. Spesifikasyon gereği geçersiz jeton için de
 * başarı döner; aksi halde bu uç jeton geçerliliğini sınamak için kullanılabilirdi.
 */
class RevokeTokenHandler {
  constructor({ unitOfWork, opaqueTokens }) {
    this.unitOfWork = unitOfWork;
    this.opaqueTokens = opaqueTokens;
  }

  async handle({ token }) {
    if (!this.opaqueTokens.isWellFormed(token)) return { revoked: false };

    return this.unitOfWork.run(async ({ oauth }) => {
      const stored = await oauth.findRefreshTokenByHash(this.opaqueTokens.hash(token));
      if (stored) await oauth.revokeRefreshTokenFamily(stored.familyId);
      return { revoked: Boolean(stored) };
    });
  }
}

module.exports = { RevokeTokenCommand, RevokeTokenHandler };
