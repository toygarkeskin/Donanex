"use strict";

import { Command, type Handler } from "../../shared/cqrs/Message";
import { ValidationError } from "../../../domain/shared/errors";
import type { Clock, OpaqueTokens, UnitOfWork } from "../../shared/contracts";

const INVALID = "Doğrulama bağlantısı geçersiz veya süresi dolmuş.";

export class VerifyEmailCommand extends Command {
  readonly token: unknown;

  constructor(input?: { token?: unknown }) {
    super();
    this.token = input?.token;
  }
}

export interface EmailVerified {
  readonly verified: true;
}

export class VerifyEmailHandler implements Handler<VerifyEmailCommand, EmailVerified> {
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

  async handle({ token }: VerifyEmailCommand): Promise<EmailVerified> {
    if (!this.opaqueTokens.isWellFormed(token)) {
      throw new ValidationError(INVALID);
    }

    return this.unitOfWork.run(async (repos) => {
      const claimed = await repos.verificationTokens.consume(
        "email_verification",
        this.opaqueTokens.hash(token as string),
        this.clock.now()
      );
      if (!claimed) throw new ValidationError(INVALID);
      await repos.users.markEmailVerified(claimed.userId);
      return { verified: true };
    });
  }
}
