"use strict";

import { Command, type Handler } from "../../shared/cqrs/Message";
import { isEmail } from "../../../domain/shared/guards";
import { EventTypes, domainEvent } from "../../../domain/shared/DomainEvent";
import { PASSWORD_RESET_TTL_MS } from "../authPolicy";
import type { Clock, OpaqueTokens, UnitOfWork } from "../../shared/contracts";

export class RequestPasswordResetCommand extends Command {
  readonly email: unknown;

  constructor(input?: { email?: unknown }) {
    super();
    this.email = input?.email;
  }
}

export interface ResetRequested {
  readonly accepted: true;
}

/**
 * Parola sıfırlama isteği.
 *
 * Bu uç, bir e-postanın kayıtlı olup olmadığını ASLA ele vermez: adres kayıtlı
 * olsa da olmasa da çağıran aynı yanıtı alır. Bağlantı tek kullanımlıktır,
 * veritabanında yalnızca özeti durur ve jeton adresin "#" kısmında taşınır,
 * böylece sunucu günlüklerine ve Referer başlığına düşmez.
 */
export class RequestPasswordResetHandler implements Handler<RequestPasswordResetCommand, ResetRequested> {
  private readonly unitOfWork: UnitOfWork;
  private readonly opaqueTokens: OpaqueTokens;
  private readonly clock: Clock;

  constructor({
    unitOfWork,
    opaqueTokens,
    clock
  }: {
    unitOfWork: UnitOfWork;
    opaqueTokens: OpaqueTokens;
    clock: Clock;
  }) {
    this.unitOfWork = unitOfWork;
    this.opaqueTokens = opaqueTokens;
    this.clock = clock;
  }

  async handle({ email }: RequestPasswordResetCommand): Promise<ResetRequested> {
    if (!isEmail(email)) return { accepted: true };
    const normalized = email.trim().toLowerCase();
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
