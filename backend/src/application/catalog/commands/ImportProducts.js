"use strict";

const { Command } = require("../../shared/cqrs/Message");
const { ValidationError, ConflictError, NotFoundError } = require("../../../domain/shared/errors");
const { requireUuid } = require("../../../domain/shared/guards");
const { Product } = require("../../../domain/catalog/Product");
const { StoreStatus } = require("../../../domain/stores/Store");
const { assertCan } = require("../../shared/authorize");

const MAX_IMPORT = 500;
const DEFAULT_IMAGE = "/images/urunler/laptopcard.png";

class ImportProductsCommand extends Command {
  constructor(input) {
    super();
    this.storeId = input?.storeId;
    this.rows = input?.rows;
  }
}

/**
 * CSV ile toplu ürün ekleme. Hepsi ya eklenir ya hiçbiri: tek satır hatalıysa
 * transaction geri alınır ve mağaza yarım bir katalogla kalmaz.
 * İçe aktarılan ürünler taslak olarak gelir, mağaza gözden geçirip yayınlar.
 */
class ImportProductsHandler {
  constructor({ unitOfWork, cache, ids }) {
    this.unitOfWork = unitOfWork;
    this.cache = cache;
    this.ids = ids;
  }

  async handle({ storeId, rows }, context = {}) {
    requireUuid(storeId, "Mağaza numarası");
    assertCan(context, "catalog:product:write", { storeId });

    if (!Array.isArray(rows) || rows.length === 0) {
      throw new ValidationError("İçe aktarılacak ürün bulunamadı.");
    }
    if (rows.length > MAX_IMPORT) {
      throw new ValidationError(`Tek seferde en fazla ${MAX_IMPORT} ürün içe aktarabilirsiniz.`);
    }

    // CSV'de ilk satır başlık olduğundan veri satırları 2'den başlar.
    const products = rows.map((row, index) =>
      Product.fromImportRow(row, index + 2, { storeId, imageUrl: DEFAULT_IMAGE })
    );

    const count = await this.unitOfWork.run(async (repos) => {
      const store = await repos.stores.findById(storeId);
      if (!store) throw new NotFoundError("Mağaza bulunamadı.");
      if (store.status !== StoreStatus.ACTIVE) {
        throw new ConflictError("Mağaza onaylanmadan ürün eklenemez.");
      }

      const prepared = [];
      for (const product of products) {
        prepared.push({
          ...product,
          id: this.ids.uuid(),
          slug: await repos.products.reserveSlug(storeId, product.slug)
        });
      }
      return repos.products.createMany(prepared);
    });

    await this.cache.deleteByPrefix("catalog:");
    return { count };
  }
}

module.exports = { ImportProductsCommand, ImportProductsHandler, MAX_IMPORT };
