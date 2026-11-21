"use strict";

import { Query, type Handler } from "../../shared/cqrs/Message";
import type { CatalogReadModel, Cache, Row } from "../../shared/contracts";

/**
 * Markalar sayfası.
 *
 * Marka, mağazadan AYRI bir eksendir: mağaza satıcıdır, marka üreticidir.
 * Aynı markayı birden çok mağaza satabilir.
 *
 * Kategoriler gibi önbelleklenir; liste nadiren değişir ve her sayfa
 * açılışında sorgulanması gereksizdir. Katalog değiştiğinde "catalog:"
 * ön ekiyle birlikte silinir.
 */
export class ListBrandsQuery extends Query {
  /** Ürün formu için: ürünü olmayan markalar da. */
  readonly tumu: boolean;

  constructor(input?: { tumu?: boolean }) {
    super();
    this.tumu = input?.tumu === true;
  }
}

export class ListBrandsHandler implements Handler<ListBrandsQuery, Row[]> {
  private readonly readModel: CatalogReadModel;
  private readonly cache: Cache;

  constructor({ catalogReadModel, cache }: { catalogReadModel: CatalogReadModel; cache: Cache }) {
    this.readModel = catalogReadModel;
    this.cache = cache;
  }

  async handle({ tumu }: ListBrandsQuery): Promise<Row[]> {
    const key = tumu ? "catalog:brands:tumu" : "catalog:brands";
    const cached = await this.cache.get<Row[]>(key);
    if (cached) return cached;

    const brands = await this.readModel.listBrands({ tumu });
    await this.cache.set(key, brands, 300);
    return brands;
  }
}
