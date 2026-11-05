"use strict";

const { Command } = require("../../shared/cqrs/Message");
const { NotFoundError } = require("../../../domain/shared/errors");
const { requireUuid } = require("../../../domain/shared/guards");
const { ProductStatus } = require("../../../domain/catalog/Product");
const { assertCan } = require("../../shared/authorize");

class DeleteProductCommand extends Command {
  constructor(input) {
    super();
    this.storeId = input?.storeId;
    this.productId = input?.productId;
  }
}

/**
 * Hiç satılmamış ürünü siler. Siparişlerde geçen ürün silinmez, arşivlenir;
 * böylece eski siparişlerin ürün bağlantısı kopmaz.
 */
class DeleteProductHandler {
  constructor({ unitOfWork, cache }) {
    this.unitOfWork = unitOfWork;
    this.cache = cache;
  }

  async handle({ storeId, productId }, context = {}) {
    requireUuid(storeId, "Mağaza numarası");
    requireUuid(productId, "Ürün numarası");
    assertCan(context, "catalog:product:delete", { storeId });

    const result = await this.unitOfWork.run(async (repos) => {
      if (await repos.products.isReferencedByOrders(productId)) {
        const archived = await repos.products.setStatus(storeId, productId, ProductStatus.ARCHIVED);
        if (!archived) throw new NotFoundError("Ürün bulunamadı.");
        return { archived: true };
      }
      const removed = await repos.products.remove(storeId, productId);
      if (!removed) throw new NotFoundError("Ürün bulunamadı.");
      await repos.audit.record({
        actorId: context.actorId ?? null,
        action: "product.deleted",
        resourceType: "product",
        resourceId: productId,
        context
      });
      return { archived: false };
    });

    await this.cache.deleteByPrefix("catalog:");
    return result;
  }
}

module.exports = { DeleteProductCommand, DeleteProductHandler };
