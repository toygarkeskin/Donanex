"use strict";

const { Command } = require("../../shared/cqrs/Message");
const { NotFoundError } = require("../../../domain/shared/errors");
const { requireUuid } = require("../../../domain/shared/guards");
const { Product } = require("../../../domain/catalog/Product");
const { assertCan } = require("../../shared/authorize");

class UpdateProductCommand extends Command {
  constructor(input) {
    super();
    this.storeId = input?.storeId;
    this.productId = input?.productId;
    this.data = input?.data;
  }
}

class UpdateProductHandler {
  constructor({ unitOfWork, cache }) {
    this.unitOfWork = unitOfWork;
    this.cache = cache;
  }

  async handle({ storeId, productId, data }, context = {}) {
    requireUuid(storeId, "Mağaza numarası");
    requireUuid(productId, "Ürün numarası");
    assertCan(context, "catalog:product:write", { storeId });

    const product = Product.create({ ...data, id: productId, storeId });

    const saved = await this.unitOfWork.run(async (repos) => {
      // storeId sorgunun parçası: başka mağazanın ürünü güncellenemez.
      const updated = await repos.products.update(storeId, product);
      if (!updated) throw new NotFoundError("Ürün bulunamadı.");
      await repos.audit.record({
        actorId: context.actorId ?? null,
        action: "product.updated",
        resourceType: "product",
        resourceId: productId,
        context
      });
      return updated;
    });

    await this.cache.deleteByPrefix("catalog:");
    return saved;
  }
}

module.exports = { UpdateProductCommand, UpdateProductHandler };
