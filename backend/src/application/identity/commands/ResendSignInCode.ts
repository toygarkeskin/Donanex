"use strict";

import { Command, type Handler } from "../../shared/cqrs/Message";
import { ConflictError, UnauthorizedError } from "../../../domain/shared/errors";
import { isUuid } from "../../../domain/shared/guards";
import { sendLoginCode } from "../services/loginCode";
import { LOGIN_CODE_MAX_SENDS, LOGIN_CODE_RESEND_SECONDS } from "../authPolicy";
import type { Clock, OpaqueTokens, UnitOfWork } from "../../shared/contracts";

export class ResendSignInCodeCommand extends Command {
  readonly challengeId: unknown;

  constructor(input?: { challengeId?: unknown }) {
    super();
    this.challengeId = input?.challengeId;
  }
}

export interface SignInCodeResent {
  readonly resent: true;
  readonly retryAfterSeconds: number;
}

const GECERSIZ = "Kodun süresi doldu ya da geçersiz. Lütfen yeniden giriş yapın.";

/**
 * Kodu yeniden gönderir. Eski kod geçersizleşir, deneme hakları sıfırlanır.
 *
 * İki sınır var: iki gönderim arası 30 saniye (kutuyu doldurmasın) ve bir
 * giriş için en fazla 5 gönderim (yeniden göndererek deneme hakkını sonsuza
 * kadar tazelemek mümkün olmasın: 5 × 5 = 25 deneme, 10^6 olasılığa karşı).
 */
export class ResendSignInCodeHandler implements Handler<ResendSignInCodeCommand, SignInCodeResent> {
  private readonly unitOfWork: UnitOfWork;
  private readonly opaqueTokens: OpaqueTokens;
  private readonly clock: Clock;

  constructor({ unitOfWork, opaqueTokens, clock }: { unitOfWork: UnitOfWork; opaqueTokens: OpaqueTokens; clock: Clock }) {
    this.unitOfWork = unitOfWork;
    this.opaqueTokens = opaqueTokens;
    this.clock = clock;
  }

  async handle({ challengeId }: ResendSignInCodeCommand): Promise<SignInCodeResent> {
    if (!isUuid(challengeId)) throw new UnauthorizedError(GECERSIZ);

    return this.unitOfWork.run(async (repos) => {
      const challenge = await repos.loginChallenges.lock(challengeId);
      const now = this.clock.now();
      if (!challenge || new Date(challenge.expiresAt) <= now) throw new UnauthorizedError(GECERSIZ);

      const gecen = (now.getTime() - new Date(challenge.lastSentAt).getTime()) / 1000;
      if (gecen < LOGIN_CODE_RESEND_SECONDS) {
        throw new ConflictError(`Yeni kod için ${Math.ceil(LOGIN_CODE_RESEND_SECONDS - gecen)} saniye bekleyin.`);
      }
      if (challenge.sends >= LOGIN_CODE_MAX_SENDS) {
        throw new ConflictError("Bu giriş için en fazla kod gönderildi. Lütfen yeniden giriş yapın.");
      }

      const user = await repos.users.findById(challenge.userId);
      if (!user) throw new UnauthorizedError(GECERSIZ);

      await sendLoginCode(repos, {
        challengeId: challenge.id,
        user: { id: String(user.id), email: String(user.email), fullName: String(user.fullName) },
        opaqueTokens: this.opaqueTokens,
        clock: this.clock,
        resend: true
      });

      return { resent: true as const, retryAfterSeconds: LOGIN_CODE_RESEND_SECONDS };
    });
  }
}
