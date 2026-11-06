"use strict";

import { Command, type Handler } from "../../shared/cqrs/Message";
import { NotFoundError, ValidationError, ConflictError } from "../../../domain/shared/errors";
import { requireUuid, requireEmail } from "../../../domain/shared/guards";
import { RoleCodes, type RoleCode } from "../../../domain/identity/Role";
import { assertCan, type UseCaseContext } from "../../shared/authorize";
import type { Cache, UnitOfWork } from "../../shared/contracts";

/** Bu uçla YALNIZCA mağazaya bağlı roller verilebilir. */
const ASSIGNABLE: readonly RoleCode[] = [RoleCodes.STORE_STAFF, RoleCodes.STORE_OWNER];

export class ManageStoreMemberCommand extends Command {
  readonly storeId: string;
  readonly email: string | null;
  readonly userId: string | null;
  readonly roleCode: RoleCode;
  readonly remove: boolean;

  constructor(input?: {
    storeId?: string;
    email?: string | null;
    userId?: string | null;
    roleCode?: RoleCode;
    remove?: unknown;
  }) {
    super();
    this.storeId = input?.storeId as string;
    this.email = input?.email ?? null;
    this.userId = input?.userId ?? null;
    this.roleCode = input?.roleCode ?? RoleCodes.STORE_STAFF;
    this.remove = input?.remove === true;
  }
}

export interface MemberResult {
  readonly userId: string;
  readonly email: string;
  readonly roleCode: RoleCode;
  readonly removed: boolean;
}

/**
 * Mağaza çalışanı ekler ya da çıkarır. Mağaza sahibi yalnızca KENDİ mağazasında
 * çalışan yönetebilir ve yalnızca mağazaya bağlı roller verebilir; bu uçla
 * sistem yöneticiliği dağıtılamaz.
 */
export class ManageStoreMemberHandler implements Handler<ManageStoreMemberCommand, MemberResult, UseCaseContext> {
  private readonly unitOfWork: UnitOfWork;
  private readonly cache: Cache;

  constructor({ unitOfWork, cache }: { unitOfWork: UnitOfWork; cache: Cache }) {
    this.unitOfWork = unitOfWork;
    this.cache = cache;
  }

  async handle(
    { storeId, email, userId, roleCode, remove }: ManageStoreMemberCommand,
    context: UseCaseContext = {}
  ): Promise<MemberResult> {
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
      return { userId: target.id as string, email: target.email as string, roleCode, removed: remove };
    });

    await this.cache.delete(`policy:${result.userId}`);
    return result;
  }
}
