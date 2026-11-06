"use strict";

import { Query, type Handler } from "../../shared/cqrs/Message";
import type { CatalogReadModel, Cache, Row } from "../../shared/contracts";

export const SORTS = {
  newest: "newest",
  price_asc: "price_asc",
  price_desc: "price_desc",
  name_asc: "name_asc"
} as const;

export type SortKey = keyof typeof SORTS;

/** Adres çubuğundan gelen ham filtreler — hiçbirine güvenilmez. */
export interface ProductFilters {
  q?: unknown;
  category?: unknown;
  store?: unknown;
  minPrice?: unknown;
  maxPrice?: unknown;
  inStock?: unknown;
  sort?: unknown;
  page?: unknown;
  pageSize?: unknown;
}

/** Read model'e giden, sınırları uygulanmış filtreler. */
export interface NormalizedProductFilters {
  readonly search: string;
  readonly categorySlug: string | null;
  readonly storeSlug: string | null;
  readonly minPriceCents: number | null;
  readonly maxPriceCents: number | null;
  readonly inStockOnly: boolean;
  readonly sort: string;
  readonly limit: number;
  readonly offset: number;
  readonly page: number;
  readonly pageSize: number;
}

export class ListProductsQuery extends Query {
  readonly filters: ProductFilters;

  constructor(filters: ProductFilters = {}) {
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
export class ListProductsHandler implements Handler<ListProductsQuery, Row> {
  private readonly readModel: CatalogReadModel;
  private readonly cache: Cache;

  constructor({ catalogReadModel, cache }: { catalogReadModel: CatalogReadModel; cache: Cache }) {
    this.readModel = catalogReadModel;
    this.cache = cache;
  }

  normalize(filters: ProductFilters): NormalizedProductFilters {
    const page = Math.max(1, Number(filters.page) || 1);
    const pageSize = Math.min(60, Math.max(1, Number(filters.pageSize) || 24));
    const price = (value: unknown): number | null => {
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
      sort: SORTS[filters.sort as SortKey] ?? SORTS.newest,
      limit: pageSize,
      offset: (page - 1) * pageSize,
      page,
      pageSize
    };
  }

  async handle({ filters }: ListProductsQuery): Promise<Row> {
    const normalized = this.normalize(filters);
    const key = `catalog:list:${JSON.stringify(normalized)}`;

    const cached = await this.cache.get<Row>(key);
    if (cached) return cached;

    const result = await this.readModel.listProducts(normalized);
    await this.cache.set(key, result, 60);
    return result;
  }
}
