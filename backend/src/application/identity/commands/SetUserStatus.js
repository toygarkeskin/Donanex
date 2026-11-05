"use strict";

const { Command } = require("../../shared/cqrs/Message");
const { NotFoundError, ConflictError } = require("../../../domain/shared/errors");
const { requireUuid, requireEnum } = require("../../../domain/shared/guards");
const { UserStatus } = require("../../../domain/identity/User");
const { RoleCodes } = require("../../../domain/identity/Role");

class SetUserStatusCommand extends Command {
  constructor(input) {
    super();
    this.userId = input?.userId;
    this.status = input?.status;
  }
}

/** Hesabı askıya alır ya da yeniden açar. Askıya alınan kişinin oturumları kapanır. */
class SetUserStatusHandler {
  constructor({ unitOfWork, cache }) {
    this.unitOfWork = unitOfWork;
    this.cache = cache;
  }

  async handle({ userId, status }, context = {}) {
    requireUuid(userId, "Kullanıcı numarası");
    requireEnum(status, Object.values(UserStatus), "Hesap durumu");

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

module.exports = { SetUserStatusCommand, SetUserStatusHandler };
