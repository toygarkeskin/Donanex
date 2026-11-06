"use strict";

import { Query, type Handler } from "../../shared/cqrs/Message";
import type { CatalogReadModel, Cache, Row } from "../../shared/contracts";

export class ListCategoriesQuery extends Query {}

export class ListCategoriesHandler implements Handler<ListCategoriesQuery, Row[]> {
  private readonly readModel: CatalogReadModel;
  private readonly cache: Cache;

  constructor({ catalogReadModel, cache }: { catalogReadModel: CatalogReadModel; cache: Cache }) {
    this.readModel = catalogReadModel;
    this.cache = cache;
  }

  async handle(): Promise<Row[]> {
    const key = "catalog:categories";
    const cached = await this.cache.get<Row[]>(key);
    if (cached) return cached;

    const categories = await this.readModel.listCategories();
    await this.cache.set(key, categories, 300);
    return categories;
  }
}
