"use strict";

const { Command } = require("../../shared/cqrs/Message");
const { NotFoundError } = require("../../../domain/shared/errors");
const { requireUuid, requireEnum } = require("../../../domain/shared/guards");
const { StoreStatus, assertStoreTransition } = require("../../../domain/stores/Store");
const { RoleCodes } = require("../../../domain/identity/Role");
const { EventTypes, domainEvent } = require("../../../domain/shared/DomainEvent");
const { assertCan } = require("../../shared/authorize");

class SetStoreStatusCommand extends Command {
  constructor(input) {
    super();
    this.storeId = input?.storeId;
    this.status = input?.status;
  }
}

/**
 * Mağaza başvurusunu onaylar ya da mağazayı askıya alır (yalnızca sistem yöneticisi).
 *
 * İlk onayda mağaza sahibine STORE_OWNER rolü O MAĞAZAYA BAĞLI olarak verilir;
 * böylece yetkisi yalnızca kendi mağazasında geçerli olur.
 * Askıya alınan mağazanın ürünleri vitrinden düşer.
 */
class SetStoreStatusHandler {
  constructor({ unitOfWork, cache }) {
    this.unitOfWork = unitOfWork;
    this.cache = cache;
  }

  async handle({ storeId, status }, context = {}) {
    requireUuid(storeId, "Mağaza numarası");
    requireEnum(status, Object.values(StoreStatus), "Mağaza durumu");
    assertCan(context, "store:approve");

    const result = await this.unitOfWork.run(async (repos) => {
      const store = await repos.stores.findById(storeId);
      if (!store) throw new NotFoundError("Mağaza bulunamadı.");
      assertStoreTransition(store.status, status);

      await repos.stores.setStatus(storeId, status);

      if (status === StoreStatus.ACTIVE) {
        await repos.roles.assign({
          userId: store.ownerUserId,
          roleCode: RoleCodes.STORE_OWNER,
          storeId
        });

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
      return { storeId, status, ownerUserId: store.ownerUserId };
    });

    await this.cache.delete(`policy:${result.ownerUserId}`);
    await this.cache.deleteByPrefix("catalog:");
    return result;
  }
}

module.exports = { SetStoreStatusCommand, SetStoreStatusHandler };
