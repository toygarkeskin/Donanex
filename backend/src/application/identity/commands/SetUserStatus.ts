"use strict";

import { Command, type Handler } from "../../shared/cqrs/Message";
import { NotFoundError, ConflictError } from "../../../domain/shared/errors";
import { requireUuid, requireEnum } from "../../../domain/shared/guards";
import { UserStatus, type UserStatusKind } from "../../../domain/identity/User";
import { RoleCodes } from "../../../domain/identity/Role";
import type { UseCaseContext } from "../../shared/authorize";
import type { Cache, UnitOfWork } from "../../shared/contracts";

export class SetUserStatusCommand extends Command {
  readonly userId: string;
  readonly status: UserStatusKind;

  constructor(input?: { userId?: string; status?: unknown }) {
    super();
    this.userId = input?.userId as string;
    this.status = input?.status as UserStatusKind;
  }
}

export interface UserStatusResult {
  readonly userId: string;
  readonly status: UserStatusKind;
}

/** Hesabı askıya alır ya da yeniden açar. Askıya alınan kişinin oturumları kapanır. */
export class SetUserStatusHandler implements Handler<SetUserStatusCommand, UserStatusResult, UseCaseContext> {
  private readonly unitOfWork: UnitOfWork;
  private readonly cache: Cache;

  constructor({ unitOfWork, cache }: { unitOfWork: UnitOfWork; cache: Cache }) {
    this.unitOfWork = unitOfWork;
    this.cache = cache;
  }

  async handle({ userId, status }: SetUserStatusCommand, context: UseCaseContext = {}): Promise<UserStatusResult> {
    requireUuid(userId, "Kullanıcı numarası");
    requireEnum(status, Object.values(UserStatus) as UserStatusKind[], "Hesap durumu");

    const result = await this.unitOfWork.run(async (repos) => {
      const user = await repos.users.findById(userId);
      if (!user) throw new NotFoundError("Kullanıcı bulunamadı.");
      if (userId === context.actorId) throw new ConflictError("Kendi hesabınızın durumunu değiştiremezsiniz.");

      if (
        status === UserStatus.SUSPENDED &&
        (await repos.roles.hasRole(userId, RoleCodes.SYSTEM_ADMIN)) &&
        (await repos.roles.countByCode(RoleCodes.SYSTEM_ADMIN)) <= 1
      ) {
        throw new ConflictError("Sistemdeki son yönetici askıya alınamaz.");
      }

      await repos.users.setStatus(userId, status);
      if (status === UserStatus.SUSPENDED) {
        // Erişim anında kesilmeli: jeton süresinin dolmasını bekleyemeyiz.
        await repos.authSessions.revokeAllForUser(userId);
        await repos.oauth.revokeRefreshTokensForUser(userId);
      }

      await repos.audit.record({
        actorId: context.actorId ?? null,
        action: `user.${status}`,
        resourceType: "user",
        resourceId: userId,
        context
      });
      return { userId, status };
    });

    await this.cache.delete(`policy:${userId}`);
    return result;
  }
}
