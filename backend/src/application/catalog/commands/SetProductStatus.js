"use strict";

const { Command } = require("../../shared/cqrs/Message");
const { NotFoundError } = require("../../../domain/shared/errors");
const { requireUuid, requireEnum } = require("../../../domain/shared/guards");
const { ProductStatus } = require("../../../domain/catalog/Product");
const { assertCan } = require("../../shared/authorize");

class SetProductStatusCommand extends Command {
  constructor(input) {
    super();
    this.storeId = input?.storeId;
    this.productId = input?.productId;
    this.status = input?.status;
  }
}

/**
 * Ürünü yayına alır, taslağa çeker ya da arşivler.
 *
 * Geçmiş siparişlerde geçen ürün SİLİNMEZ, arşivlenir: sipariş kayıtlarının
 * ürün adı ve fiyatı zaten sipariş satırında saklandığı için geçmiş bozulmaz,
 * ama ürün kaydı da referans bütünlüğünü koruyarak yerinde kalır.
 */
class SetProductStatusHandler {
  constructor({ unitOfWork, cache }) {
    this.unitOfWork = unitOfWork;
    this.cache = cache;
  }

  async handle({ storeId, productId, status }, context = {}) {
    requireUuid(storeId, "Mağaza numarası");
    requireUuid(productId, "Ürün numarası");
    requireEnum(status, Object.values(ProductStatus), "Ürün durumu");
    assertCan(context, "catalog:product:write", { storeId });

    const result = await this.unitOfWork.run(async (repos) => {
      const updated = await repos.products.setStatus(storeId, productId, status);
      if (!updated) throw new NotFoundError("Ürün bulunamadı.");
      await repos.audit.record({
        actorId: context.actorId ?? null,
        action: `product.${status}`,
        resourceType: "product",
        resourceId: productId,
        context
      });
      return updated;
    });

    await this.cache.deleteByPrefix("catalog:");
    return result;
  }
}

module.exports = { SetProductStatusCommand, SetProductStatusHandler };
