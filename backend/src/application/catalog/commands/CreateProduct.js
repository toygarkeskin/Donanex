"use strict";

const { Command } = require("../../shared/cqrs/Message");
const { ConflictError, NotFoundError } = require("../../../domain/shared/errors");
const { requireUuid } = require("../../../domain/shared/guards");
const { Product } = require("../../../domain/catalog/Product");
const { StoreStatus } = require("../../../domain/stores/Store");
const { assertCan } = require("../../shared/authorize");

class CreateProductCommand extends Command {
  constructor(input) {
    super();
    this.storeId = input?.storeId;
    this.data = input?.data;
  }
}

class CreateProductHandler {
  constructor({ unitOfWork, cache, ids }) {
    this.unitOfWork = unitOfWork;
    this.cache = cache;
    this.ids = ids;
  }

  async handle({ storeId, data }, context = {}) {
    requireUuid(storeId, "Mağaza numarası");
    assertCan(context, "catalog:product:write", { storeId });

    const product = Product.create({ ...data, id: this.ids.uuid(), storeId });

    const saved = await this.unitOfWork.run(async (repos) => {
      const store = await repos.stores.findById(storeId);
      if (!store) throw new NotFoundError("Mağaza bulunamadı.");
      if (store.status !== StoreStatus.ACTIVE) {
        throw new ConflictError("Mağaza onaylanmadan ürün eklenemez.");
      }
      // Aynı mağaza içinde adres (slug) benzersiz olmalı.
      const slug = await repos.products.reserveSlug(storeId, product.slug);
      const created = await repos.products.create({ ...product, slug });

      await repos.audit.record({
        actorId: context.actorId ?? null,
        action: "product.created",
        resourceType: "product",
        resourceId: created.id,
        context
      });
      return created;
    });

    await this.cache.deleteByPrefix("catalog:");
    return saved;
  }
}

module.exports = { CreateProductCommand, CreateProductHandler };
