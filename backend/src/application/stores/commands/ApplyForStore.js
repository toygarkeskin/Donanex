"use strict";

const { Command } = require("../../shared/cqrs/Message");
const { ConflictError } = require("../../../domain/shared/errors");
const { createStoreApplication } = require("../../../domain/stores/Store");
const { EventTypes, domainEvent } = require("../../../domain/shared/DomainEvent");

class ApplyForStoreCommand extends Command {
  constructor(input) {
    super();
    this.userId = input?.userId;
    this.data = input?.data;
  }
}

/**
 * Mağaza başvurusu. Herhangi bir kayıtlı kullanıcı başvurabilir; mağaza
 * yönetici onaylayana kadar "pending" durumundadır ve vitrinde görünmez.
 * Mağaza sahibi rolü de ancak onayla birlikte verilir.
 */
class ApplyForStoreHandler {
  constructor({ unitOfWork, ids }) {
    this.unitOfWork = unitOfWork;
    this.ids = ids;
  }

  async handle({ userId, data }, context = {}) {
    const application = createStoreApplication(data);

    return this.unitOfWork.run(async (repos) => {
      if (await repos.stores.slugExists(application.slug)) {
        throw new ConflictError("Bu mağaza adı kullanılıyor, başka bir ad deneyin.");
      }
      if (await repos.stores.hasPendingApplication(userId)) {
        throw new ConflictError("Zaten onay bekleyen bir mağaza başvurunuz var.");
      }

      const store = await repos.stores.create({
        id: this.ids.uuid(),
        ownerUserId: userId,
        ...application
      });

      await repos.outbox.add(
        domainEvent(EventTypes.STORE_APPLIED, "store", store.id, { name: store.name, ownerUserId: userId })
      );
      await repos.audit.record({
        actorId: userId,
        action: "store.applied",
        resourceType: "store",
        resourceId: store.id,
        context
      });
      return store;
    });
  }
}

module.exports = { ApplyForStoreCommand, ApplyForStoreHandler };
