"use strict";

import { Command, type Handler } from "../../shared/cqrs/Message";
import { ValidationError } from "../../../domain/shared/errors";
import { assertPasswordStrength } from "../../../domain/identity/User";
import type { UseCaseContext } from "../../shared/authorize";
import type { Cache, Clock, OpaqueTokens, PasswordHasher, UnitOfWork } from "../../shared/contracts";

const INVALID = "Sıfırlama bağlantısı geçersiz veya süresi dolmuş.";

export class ResetPasswordCommand extends Command {
  readonly token: unknown;
  readonly newPassword: unknown;

  constructor(input?: { token?: unknown; newPassword?: unknown }) {
    super();
    this.token = input?.token;
    this.newPassword = input?.newPassword;
  }
}

export interface ResetDone {
  readonly reset: true;
}

/** Jeton tek kullanımlıktır; başarıda kullanıcının tüm oturumları sonlanır. */
export class ResetPasswordHandler implements Handler<ResetPasswordCommand, ResetDone, UseCaseContext> {
  private readonly unitOfWork: UnitOfWork;
  private readonly passwordHasher: PasswordHasher;
  private readonly opaqueTokens: OpaqueTokens;
  private readonly cache: Cache;
  private readonly clock: Clock;

  constructor({
    unitOfWork,
    passwordHasher,
    opaqueTokens,
    cache,
    clock
  }: {
    unitOfWork: UnitOfWork;
    passwordHasher: PasswordHasher;
    opaqueTokens: OpaqueTokens;
    cache: Cache;
    clock: Clock;
  }) {
    this.unitOfWork = unitOfWork;
    this.passwordHasher = passwordHasher;
    this.opaqueTokens = opaqueTokens;
    this.cache = cache;
    this.clock = clock;
  }

  async handle({ token, newPassword }: ResetPasswordCommand, context: UseCaseContext = {}): Promise<ResetDone> {
    if (!this.opaqueTokens.isWellFormed(token)) throw new ValidationError(INVALID);
    assertPasswordStrength(newPassword);
    const passwordHash = await this.passwordHasher.hash(newPassword as string);

    const userId = await this.unitOfWork.run(async (repos) => {
      const claimed = await repos.verificationTokens.consume(
        "password_reset",
        this.opaqueTokens.hash(token as string),
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
      return claimed.userId as string;
    });

    await this.cache.delete(`policy:${userId}`);
    return { reset: true };
  }
}
