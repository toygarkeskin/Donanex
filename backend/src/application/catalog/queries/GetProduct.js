"use strict";

const { Query } = require("../../shared/cqrs/Message");
const { NotFoundError } = require("../../../domain/shared/errors");

class GetProductQuery extends Query {
  constructor(input) {
    super();
    this.storeSlug = input?.storeSlug;
    this.productSlug = input?.productSlug;
  }
}

class GetProductHandler {
  constructor({ catalogReadModel, cache }) {
    this.readModel = catalogReadModel;
    this.cache = cache;
  }

  async handle({ storeSlug, productSlug }) {
    const key = `catalog:product:${storeSlug}/${productSlug}`;
    const cached = await this.cache.get(key);
    if (cached) return cached;

    const product = await this.readModel.getProductBySlug(storeSlug, productSlug);
    if (!product) throw new NotFoundError("Ürün bulunamadı.");

    await this.cache.set(key, product, 60);
    return product;
  }
}

module.exports = { GetProductQuery, GetProductHandler };
