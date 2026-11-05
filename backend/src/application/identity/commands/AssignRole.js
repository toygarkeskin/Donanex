"use strict";

const { Command } = require("../../shared/cqrs/Message");
const { ValidationError, NotFoundError, ConflictError } = require("../../../domain/shared/errors");
const { requireUuid } = require("../../../domain/shared/guards");
const { RoleCodes } = require("../../../domain/identity/Role");

class AssignRoleCommand extends Command {
  constructor(input) {
    super();
    this.userId = input?.userId;
    this.roleCode = input?.roleCode;
    this.storeId = input?.storeId ?? null;
    this.revoke = input?.revoke === true;
  }
}

/**
 * Rol atama ve geri alma. Yalnızca "role:assign" iznine sahip (sistem yöneticisi)
 * kişi çağırabilir; yetki denetimi rotada yapılır.
 *
 * Mağazaya bağlı roller mağaza kimliği olmadan, sistem genelindeki roller
 * mağaza kimliğiyle atanamaz.
 */
class AssignRoleHandler {
  constructor({ unitOfWork, cache }) {
    this.unitOfWork = unitOfWork;
    this.cache = cache;
  }

  async handle({ userId, roleCode, storeId, revoke }, context = {}) {
    requireUuid(userId, "Kullanıcı numarası");

    const result = await this.unitOfWork.run(async (repos) => {
      const role = await repos.roles.findByCode(roleCode);
      if (!role) throw new ValidationError("Rol bulunamadı.");

      const needsStore = role.scope === "store";
      if (needsStore && !storeId) throw new ValidationError("Bu rol bir mağazaya bağlı olmalı.");
      if (!needsStore && storeId) throw new ValidationError("Bu rol bir mağazaya bağlanamaz.");
      if (storeId && !(await repos.stores.exists(storeId))) throw new NotFoundError("Mağaza bulunamadı.");

      const user = await repos.users.findById(userId);
      if (!user) throw new NotFoundError("Kullanıcı bulunamadı.");

      if (revoke) {
        // Sistemde en az bir yönetici kalmalı.
        if (roleCode === RoleCodes.SYSTEM_ADMIN && (await repos.roles.countByCode(RoleCodes.SYSTEM_ADMIN)) <= 1) {
          throw new ConflictError("Sistemdeki son yöneticinin rolü kaldırılamaz.");
        }
        await repos.roles.revoke({ userId, roleCode, storeId });
      } else {
        await repos.roles.assign({ userId, roleCode, storeId });
      }

      await repos.audit.record({
        actorId: context.actorId ?? null,
        action: revoke ? "role.revoked" : "role.assigned",
        resourceType: "user",
        resourceId: userId,
        metadata: { roleCode, storeId },
        context
      });
      return { userId, roleCode, storeId, revoked: revoke };
    });

    await this.cache.delete(`policy:${userId}`);
    return result;
  }
}

module.exports = { AssignRoleCommand, AssignRoleHandler };
