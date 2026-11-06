"use strict";

import { Command, type Handler } from "../../shared/cqrs/Message";
import { ValidationError, NotFoundError, ConflictError } from "../../../domain/shared/errors";
import { requireUuid } from "../../../domain/shared/guards";
import { RoleCodes } from "../../../domain/identity/Role";
import type { UseCaseContext } from "../../shared/authorize";
import type { Cache, UnitOfWork } from "../../shared/contracts";

export class AssignRoleCommand extends Command {
  readonly userId: string;
  readonly roleCode: string;
  readonly storeId: string | null;
  readonly revoke: boolean;

  constructor(input?: { userId?: string; roleCode?: string; storeId?: string | null; revoke?: unknown }) {
    super();
    this.userId = input?.userId as string;
    this.roleCode = input?.roleCode as string;
    this.storeId = input?.storeId ?? null;
    this.revoke = input?.revoke === true;
  }
}

export interface RoleAssignmentResult {
  readonly userId: string;
  readonly roleCode: string;
  readonly storeId: string | null;
  readonly revoked: boolean;
}

/**
 * Rol atama ve geri alma. Yalnızca "role:assign" iznine sahip (sistem yöneticisi)
 * kişi çağırabilir; yetki denetimi rotada yapılır.
 *
 * Mağazaya bağlı roller mağaza kimliği olmadan, sistem genelindeki roller
 * mağaza kimliğiyle atanamaz.
 */
export class AssignRoleHandler implements Handler<AssignRoleCommand, RoleAssignmentResult, UseCaseContext> {
  private readonly unitOfWork: UnitOfWork;
  private readonly cache: Cache;

  constructor({ unitOfWork, cache }: { unitOfWork: UnitOfWork; cache: Cache }) {
    this.unitOfWork = unitOfWork;
    this.cache = cache;
  }

  async handle(
    { userId, roleCode, storeId, revoke }: AssignRoleCommand,
    context: UseCaseContext = {}
  ): Promise<RoleAssignmentResult> {
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

    // Yetki değişimi anında geçerli olmalı: önbellekteki eski kayıt silinir.
    await this.cache.delete(`policy:${userId}`);
    return result;
  }
}
