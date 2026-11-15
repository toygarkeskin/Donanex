"use strict";

import { Query, type Handler } from "../../shared/cqrs/Message";
import { isUuid } from "../../../domain/shared/guards";
import { complementsFor } from "../../../domain/catalog/Complements";
import type { Cache, CatalogReadModel, Row } from "../../shared/contracts";

export class ListRecommendationsQuery extends Query {
  readonly productIds: unknown;
  readonly limit: unknown;

  constructor(input?: { productIds?: unknown; limit?: unknown }) {
    super();
    this.productIds = input?.productIds;
    this.limit = input?.limit;
  }
}

/** Bir istekte en fazla kaç ürün için öneri hesaplanacağı (sepet büyük olabilir). */
const EN_FAZLA_URUN = 50;
/** Şeritte en fazla kaç öneri. Şerit kaydırılabildiği için cömert. */
const EN_FAZLA_ONERI = 30;

/**
 * "Bunları da sepete ekleyebilirsiniz" önerileri.
 *
 * Ürün verilirse (sepet ya da ürün sayfası) TAMAMLAYICI kategorilerden:
 * mouse alana klavye, mousepad, kulaklık — bir mouse daha değil. Sepetteki
 * ürünlerin kendi kategorileri öneriden tamamen çıkarılıyor.
 *
 * Ürün verilmezse (boş sepet) farklı kategorilerden en yeni ürünler:
 * "bunlara göz atabilirsiniz".
 *
 * Kimlikler ADRESTEN geliyor ve doğrulanıyor; geçersiz olanlar sessizce
 * atlanıyor (hata değil — öneri isteği bozuk bir kimlik yüzünden boş sayfa
 * göstermemeli).
 */
export class ListRecommendationsHandler implements Handler<ListRecommendationsQuery, Row> {
  private readonly readModel: CatalogReadModel;
  private readonly cache: Cache;

  constructor({ catalogReadModel, cache }: { catalogReadModel: CatalogReadModel; cache: Cache }) {
    this.readModel = catalogReadModel;
    this.cache = cache;
  }

  async handle({ productIds, limit }: ListRecommendationsQuery): Promise<Row> {
    const ham = Array.isArray(productIds) ? productIds : productIds ? [productIds] : [];
    const kimlikler = [...new Set(ham.filter(isUuid))].sort().slice(0, EN_FAZLA_URUN);
    const adet = Math.min(EN_FAZLA_ONERI, Math.max(1, Number(limit) || 12));

    // Önbellek anahtarı SIRALANMIŞ kimliklerden: aynı sepet, farklı sırada
    // gelse de aynı kaydı kullanır.
    const anahtar = `catalog:oneri:${kimlikler.join(",")}:${adet}`;
    const onbellekte = await this.cache.get<Row>(anahtar);
    if (onbellekte) return onbellekte;

    const kendiKategorileri = await this.readModel.categorySlugsOf(kimlikler);
    const tamamlayicilar = complementsFor(kendiKategorileri);

    const items = await this.readModel.listRecommendations({
      preferSlugs: tamamlayicilar,
      excludeSlugs: kendiKategorileri,
      excludeProductIds: kimlikler,
      limit: adet
    });

    const sonuc = { items, basis: kimlikler.length ? "tamamlayici" : "genel" };
    await this.cache.set(anahtar, sonuc, 60);
    return sonuc;
  }
}
