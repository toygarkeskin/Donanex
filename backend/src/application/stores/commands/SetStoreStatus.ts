"use strict";

import { Command, type Handler } from "../../shared/cqrs/Message";
import { NotFoundError } from "../../../domain/shared/errors";
import { requireUuid, requireEnum } from "../../../domain/shared/guards";
import { StoreStatus, assertStoreTransition, type StoreStatusKind } from "../../../domain/stores/Store";
import { RoleCodes } from "../../../domain/identity/Role";
import { EventTypes, domainEvent } from "../../../domain/shared/DomainEvent";
import { assertCan, type UseCaseContext } from "../../shared/authorize";
import type { Cache, UnitOfWork } from "../../shared/contracts";

export class SetStoreStatusCommand extends Command {
  readonly storeId: string;
  readonly status: StoreStatusKind;

  constructor(input?: { storeId?: string; status?: unknown }) {
    super();
    this.storeId = input?.storeId as string;
    this.status = input?.status as StoreStatusKind;
  }
}

export interface StoreStatusResult {
  readonly storeId: string;
  readonly status: StoreStatusKind;
  readonly ownerUserId: string;
}

/**
 * Mağaza başvurusunu onaylar ya da mağazayı askıya alır (yalnızca sistem yöneticisi).
 *
 * İlk onayda mağaza sahibine STORE_OWNER rolü O MAĞAZAYA BAĞLI olarak verilir;
 * böylece yetkisi yalnızca kendi mağazasında geçerli olur.
 * Askıya alınan mağazanın ürünleri vitrinden düşer.
 */
export class SetStoreStatusHandler implements Handler<SetStoreStatusCommand, StoreStatusResult, UseCaseContext> {
  private readonly unitOfWork: UnitOfWork;
  private readonly cache: Cache;

  constructor({ unitOfWork, cache }: { unitOfWork: UnitOfWork; cache: Cache }) {
    this.unitOfWork = unitOfWork;
    this.cache = cache;
  }

  async handle({ storeId, status }: SetStoreStatusCommand, context: UseCaseContext = {}): Promise<StoreStatusResult> {
    requireUuid(storeId, "Mağaza numarası");
    requireEnum(status, Object.values(StoreStatus) as StoreStatusKind[], "Mağaza durumu");
    assertCan(context, "store:approve");

    const result = await this.unitOfWork.run(async (repos) => {
      const store = await repos.stores.findById(storeId);
      if (!store) throw new NotFoundError("Mağaza bulunamadı.");
      assertStoreTransition(store.status, status);

      await repos.stores.setStatus(storeId, status);

      if (status === StoreStatus.ACTIVE) {
        await repos.roles.assign({ userId: store.ownerUserId, roleCode: RoleCodes.STORE_OWNER, storeId });

        // Olay kendi kendine yeterli olmalı: e-posta tüketicisi alıcıyı
        // yalnızca olay içeriğinden bulur, veritabanına geri dönmez.
        const owner = await repos.users.findById(store.ownerUserId);
        await repos.outbox.add(
          domainEvent(EventTypes.STORE_APPROVED, "store", storeId, {
            name: store.name,
            ownerUserId: store.ownerUserId,
            email: owner?.email ?? null,
            fullName: owner?.fullName ?? null
          })
        );
      }

      await repos.audit.record({
        actorId: context.actorId ?? null,
        action: `store.${status}`,
        resourceType: "store",
        resourceId: storeId,
        context
      });
      return { storeId, status, ownerUserId: store.ownerUserId as string };
    });

    await this.cache.delete(`policy:${result.ownerUserId}`);
    await this.cache.deleteByPrefix("catalog:");
    return result;
  }
}
