"use strict";

import { Query, type Handler } from "../../shared/cqrs/Message";
import { NotFoundError } from "../../../domain/shared/errors";
import type { CatalogReadModel, Cache, Row } from "../../shared/contracts";

export class GetProductQuery extends Query {
  readonly storeSlug: string;
  readonly productSlug: string;

  constructor(input?: { storeSlug?: string; productSlug?: string }) {
    super();
    this.storeSlug = input?.storeSlug as string;
    this.productSlug = input?.productSlug as string;
  }
}

export class GetProductHandler implements Handler<GetProductQuery, Row> {
  private readonly readModel: CatalogReadModel;
  private readonly cache: Cache;

  constructor({ catalogReadModel, cache }: { catalogReadModel: CatalogReadModel; cache: Cache }) {
    this.readModel = catalogReadModel;
    this.cache = cache;
  }

  async handle({ storeSlug, productSlug }: GetProductQuery): Promise<Row> {
    const key = `catalog:product:${storeSlug}/${productSlug}`;
    const cached = await this.cache.get<Row>(key);
    if (cached) return cached;

    const product = await this.readModel.getProductBySlug(storeSlug, productSlug);
    if (!product) throw new NotFoundError("Ürün bulunamadı.");

    await this.cache.set(key, product, 60);
    return product;
  }
}
