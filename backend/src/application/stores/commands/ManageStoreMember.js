"use strict";

const { Command } = require("../../shared/cqrs/Message");
const { NotFoundError, ValidationError, ConflictError } = require("../../../domain/shared/errors");
const { requireUuid, requireEmail } = require("../../../domain/shared/guards");
const { RoleCodes } = require("../../../domain/identity/Role");
const { assertCan } = require("../../shared/authorize");

const ASSIGNABLE = [RoleCodes.STORE_STAFF, RoleCodes.STORE_OWNER];

class ManageStoreMemberCommand extends Command {
  constructor(input) {
    super();
    this.storeId = input?.storeId;
    this.email = input?.email ?? null;
    this.userId = input?.userId ?? null;
    this.roleCode = input?.roleCode ?? RoleCodes.STORE_STAFF;
    this.remove = input?.remove === true;
  }
}

/**
 * Mağaza çalışanı ekler ya da çıkarır. Mağaza sahibi yalnızca KENDİ mağazasında
 * çalışan yönetebilir ve yalnızca mağazaya bağlı roller verebilir; bu uçla
 * sistem yöneticiliği dağıtılamaz.
 */
class ManageStoreMemberHandler {
  constructor({ unitOfWork, cache }) {
    this.unitOfWork = unitOfWork;
    this.cache = cache;
  }

  async handle({ storeId, email, userId, roleCode, remove }, context = {}) {
    requireUuid(storeId, "Mağaza numarası");
    assertCan(context, "store:member:manage", { storeId });
    if (!ASSIGNABLE.includes(roleCode)) throw new ValidationError("Bu rol mağazaya atanamaz.");

    const result = await this.unitOfWork.run(async (repos) => {
      const store = await repos.stores.findById(storeId);
      if (!store) throw new NotFoundError("Mağaza bulunamadı.");

      const target = userId
        ? await repos.users.findById(requireUuid(userId, "Kullanıcı numarası"))
        : await repos.users.findCredentialsByEmail(requireEmail(email));
      if (!target) throw new NotFoundError("Kullanıcı bulunamadı.");

      if (remove) {
        if (target.id === store.ownerUserId) {
          throw new ConflictError("Mağaza sahibi mağazadan çıkarılamaz.");
        }
        await repos.roles.revoke({ userId: target.id, roleCode, storeId });
      } else {
        await repos.roles.assign({ userId: target.id, roleCode, storeId });
      }

      await repos.audit.record({
        actorId: context.actorId ?? null,
        action: remove ? "store.member_removed" : "store.member_added",
        resourceType: "store",
        resourceId: storeId,
        metadata: { targetUserId: target.id, roleCode },
        context
      });
      return { userId: target.id, email: target.email, roleCode, removed: remove };
    });

    await this.cache.delete(`policy:${result.userId}`);
    return result;
  }
}

module.exports = { ManageStoreMemberCommand, ManageStoreMemberHandler };
