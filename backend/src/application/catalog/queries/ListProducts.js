"use strict";

const { Query } = require("../../shared/cqrs/Message");

const SORTS = Object.freeze({
  newest: "newest",
  price_asc: "price_asc",
  price_desc: "price_desc",
  name_asc: "name_asc"
});

class ListProductsQuery extends Query {
  constructor(filters = {}) {
    super();
    this.filters = filters;
  }
}

/**
 * Vitrin listesi. Yalnızca aktif mağazaların yayındaki ürünlerini döndürür.
 *
 * Sonuç Redis'te önbelleklenir; katalog değiştiğinde (ürün, mağaza durumu,
 * kategori) "catalog:" ön ekli anahtarların tamamı silinir.
 */
class ListProductsHandler {
  constructor({ catalogReadModel, cache }) {
    this.readModel = catalogReadModel;
    this.cache = cache;
  }

  normalize(filters) {
    const page = Math.max(1, Number(filters.page) || 1);
    const pageSize = Math.min(60, Math.max(1, Number(filters.pageSize) || 24));
    const price = (value) => {
      const number = Number(value);
      return Number.isFinite(number) && number >= 0 ? Math.round(number * 100) : null;
    };
    return {
      search: typeof filters.q === "string" ? filters.q.trim().slice(0, 100) : "",
      categorySlug: typeof filters.category === "string" ? filters.category.slice(0, 120) : null,
      storeSlug: typeof filters.store === "string" ? filters.store.slice(0, 120) : null,
      minPriceCents: price(filters.minPrice),
      maxPriceCents: price(filters.maxPrice),
      inStockOnly: String(filters.inStock) === "true",
      sort: SORTS[filters.sort] || SORTS.newest,
      limit: pageSize,
      offset: (page - 1) * pageSize,
      page,
      pageSize
    };
  }

  async handle({ filters }) {
    const normalized = this.normalize(filters);
    const key = `catalog:list:${JSON.stringify(normalized)}`;

    const cached = await this.cache.get(key);
    if (cached) return cached;

    const result = await this.readModel.listProducts(normalized);
    await this.cache.set(key, result, 60);
    return result;
  }
}

module.exports = { ListProductsQuery, ListProductsHandler, SORTS };
