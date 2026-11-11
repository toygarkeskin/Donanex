"use strict";

import { Query, type Handler } from "../../shared/cqrs/Message";
import { NotFoundError } from "../../../domain/shared/errors";
import type { CatalogReadModel, Cache, Row } from "../../shared/contracts";

export class GetBrandQuery extends Query {
  readonly slug: string;

  constructor(input?: { slug?: string }) {
    super();
    this.slug = input?.slug as string;
  }
}

/**
 * Marka sayfası: markanın kendisi ve onu SATAN MAĞAZALAR.
 *
 * Mağaza listesi buraya dahil çünkü sayfanın asıl sorusu "bu markayı kimden
 * alırım". Ürünler ayrı uçtan (ürün listesi, marka filtresiyle) geliyor:
 * orada sayfalama, sıralama ve diğer filtreler zaten çalışıyor, hepsini
 * burada ikinci kez yazmak gerekmiyor.
 */
export class GetBrandHandler implements Handler<GetBrandQuery, Row> {
  private readonly readModel: CatalogReadModel;
  private readonly cache: Cache;

  constructor({ catalogReadModel, cache }: { catalogReadModel: CatalogReadModel; cache: Cache }) {
    this.readModel = catalogReadModel;
    this.cache = cache;
  }

  async handle({ slug }: GetBrandQuery): Promise<Row> {
    const key = `catalog:brand:${slug}`;
    const cached = await this.cache.get<Row>(key);
    if (cached) return cached;

    const brand = await this.readModel.getBrandBySlug(slug);
    if (!brand) throw new NotFoundError("Marka bulunamadı.");

    const stores = await this.readModel.listBrandStores(brand.id as string);
    const sonuc = { ...brand, stores };

    await this.cache.set(key, sonuc, 300);
    return sonuc;
  }
}
