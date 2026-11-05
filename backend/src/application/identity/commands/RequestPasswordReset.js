"use strict";

const { Command } = require("../../shared/cqrs/Message");
const { isEmail } = require("../../../domain/shared/guards");
const { EventTypes, domainEvent } = require("../../../domain/shared/DomainEvent");
const { PASSWORD_RESET_TTL_MS } = require("../authPolicy");

class RequestPasswordResetCommand extends Command {
  constructor(input) {
    super();
    this.email = input?.email;
  }
}

/**
 * Parola sıfırlama isteği.
 *
 * Bu uç, bir e-postanın kayıtlı olup olmadığını ASLA ele vermez: adres kayıtlı
 * olsa da olmasa da çağıran aynı yanıtı alır. Bağlantı tek kullanımlıktır,
 * veritabanında yalnızca özeti durur ve jeton adresin "#" kısmında taşınır,
 * böylece sunucu günlüklerine ve Referer başlığına düşmez.
 */
class RequestPasswordResetHandler {
  constructor({ unitOfWork, opaqueTokens, clock }) {
    this.unitOfWork = unitOfWork;
    this.opaqueTokens = opaqueTokens;
    this.clock = clock;
  }

  async handle({ email }) {
    if (!isEmail(email)) return { accepted: true };
    const normalized = String(email).trim().toLowerCase();
    const token = this.opaqueTokens.generate();

    await this.unitOfWork.run(async (repos) => {
      const user = await repos.users.findCredentialsByEmail(normalized);
      if (!user) return;

      await repos.verificationTokens.replace({
        purpose: "password_reset",
        userId: user.id,
        tokenHash: this.opaqueTokens.hash(token),
        expiresAt: new Date(this.clock.now().getTime() + PASSWORD_RESET_TTL_MS)
      });

      await repos.outbox.add(
        domainEvent(EventTypes.USER_PASSWORD_RESET_REQUESTED, "user", user.id, {
          email: user.email,
          fullName: user.fullName,
          resetToken: token
        })
      );
    });

    return { accepted: true };
  }
}

module.exports = { RequestPasswordResetCommand, RequestPasswordResetHandler };
