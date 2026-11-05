"use strict";

const { Query } = require("../../shared/cqrs/Message");

class ListCategoriesQuery extends Query {}

class ListCategoriesHandler {
  constructor({ catalogReadModel, cache }) {
    this.readModel = catalogReadModel;
    this.cache = cache;
  }

  async handle() {
    const key = "catalog:categories";
    const cached = await this.cache.get(key);
    if (cached) return cached;

    const categories = await this.readModel.listCategories();
    await this.cache.set(key, categories, 300);
    return categories;
  }
}

module.exports = { ListCategoriesQuery, ListCategoriesHandler };
