"use strict";

const { Command } = require("../../shared/cqrs/Message");
const { NotFoundError } = require("../../../domain/shared/errors");
const { requireUuid } = require("../../../domain/shared/guards");
const { validateStoreUpdate } = require("../../../domain/stores/Store");
const { assertCan } = require("../../shared/authorize");

class UpdateStoreCommand extends Command {
  constructor(input) {
    super();
    this.storeId = input?.storeId;
    this.data = input?.data;
  }
}

class UpdateStoreHandler {
  constructor({ unitOfWork, cache }) {
    this.unitOfWork = unitOfWork;
    this.cache = cache;
  }

  async handle({ storeId, data }, context = {}) {
    requireUuid(storeId, "Mağaza numarası");
    assertCan(context, "store:write", { storeId });
    const update = validateStoreUpdate(data);

    const store = await this.unitOfWork.run(async (repos) => {
      const updated = await repos.stores.update(storeId, update);
      if (!updated) throw new NotFoundError("Mağaza bulunamadı.");
      await repos.audit.record({
        actorId: context.actorId ?? null,
        action: "store.updated",
        resourceType: "store",
        resourceId: storeId,
        context
      });
      return updated;
    });

    await this.cache.deleteByPrefix("catalog:");
    return store;
  }
}

module.exports = { UpdateStoreCommand, UpdateStoreHandler };
