"use strict";

import { Command, type Handler } from "../../shared/cqrs/Message";
import { UnauthorizedError, NotFoundError } from "../../../domain/shared/errors";
import { assertPasswordStrength } from "../../../domain/identity/User";
import { EventTypes, domainEvent } from "../../../domain/shared/DomainEvent";
import { issueSsoSession, type IssuedSsoSession } from "../services/issueSession";
import type { UseCaseContext } from "../../shared/authorize";
import type { Cache, Clock, OpaqueTokens, PasswordHasher, UnitOfWork } from "../../shared/contracts";

export class ChangePasswordCommand extends Command {
  readonly userId: string;
  readonly currentPassword: unknown;
  readonly newPassword: unknown;

  constructor(input?: { userId?: string; currentPassword?: unknown; newPassword?: unknown }) {
    super();
    this.userId = input?.userId as string;
    this.currentPassword = input?.currentPassword;
    this.newPassword = input?.newPassword;
  }
}

export interface ChangePasswordResult {
  readonly session: IssuedSsoSession;
}

/**
 * Parola değiştirme. Mevcut parola sorulur ve işlem bitince kullanıcının
 * BAŞKA tüm oturumları ve yenileme jetonları iptal edilir; bu cihaza yeni bir
 * oturum verilir. Parolası çalınmış bir hesap böylece tek hamleyle kurtarılır.
 */
export class ChangePasswordHandler implements Handler<ChangePasswordCommand, ChangePasswordResult, UseCaseContext> {
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

  async handle(
    { userId, currentPassword, newPassword }: ChangePasswordCommand,
    context: UseCaseContext = {}
  ): Promise<ChangePasswordResult> {
    const user = await this.unitOfWork.run(({ users }) => users.findById(userId));
    if (!user) throw new NotFoundError("Hesap bulunamadı.");

    const ok =
      typeof currentPassword === "string" &&
      currentPassword.length <= 200 &&
      (await this.passwordHasher.verify(currentPassword, user.passwordHash));
    if (!ok) throw new UnauthorizedError("Mevcut parola hatalı.");

    assertPasswordStrength(newPassword, { email: user.email });
    const passwordHash = await this.passwordHasher.hash(newPassword as string);

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

    // Oturum sürümü arttı: önbellekteki eski yetki kaydı düşmeli.
    await this.cache.delete(`policy:${user.id}`);
    return result;
  }
}
