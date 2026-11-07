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

/**
 * Çoklu seçimli filtrede en fazla kaç değer kabul edilir.
 *
 * Sınırsız bırakılsaydı tek bir istekle binlerce slug gönderilip hem SQL
 * parametresi hem önbellek anahtarı şişirilebilirdi. Yirmi, gerçek bir
 * kullanıcının seçebileceğinin çok üzerinde.
 */
const COKLU_FILTRE_SINIRI = 20;

/**
 * Çoklu seçimli filtre değerini listeye çevirir.
 *
 * Üç biçimi de kabul eder: tek değer ("laptop"), virgülle ayrılmış liste
 * ("laptop,monitor") ve tekrarlı parametre (?kategori=laptop&kategori=monitor
 * — Express bunu dizi olarak verir). Tek değer biçiminin korunması önemli:
 * başlıktaki kategori şeridi ve ürün kartları hâlâ tek slug gönderiyor.
 *
 * Yinelenenler atılır ve liste SIRALANIR; sıralama, aynı seçimin her zaman
 * aynı önbellek anahtarını üretmesini sağlar (a,b ile b,a aynı sorgudur).
 */
function slugListesi(value: unknown): string[] {
  const parcalar = Array.isArray(value) ? value : [value];
  const slugler = parcalar
    .filter((parca): parca is string => typeof parca === "string")
    .flatMap((parca) => parca.split(","))
    .map((parca) => parca.trim().slice(0, 120))
    .filter(Boolean);
  return [...new Set(slugler)].sort().slice(0, COKLU_FILTRE_SINIRI);
}

/** Read model'e giden, sınırları uygulanmış filtreler. */
export interface NormalizedProductFilters {
  readonly search: string;
  /** Boş dizi "filtre yok" demektir; birden çok kategori VEYA'lanır. */
  readonly categorySlugs: readonly string[];
  readonly storeSlugs: readonly string[];
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
      categorySlugs: slugListesi(filters.category),
      storeSlugs: slugListesi(filters.store),
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
