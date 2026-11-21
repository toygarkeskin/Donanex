"use strict";

import { Command, type Handler } from "../../shared/cqrs/Message";
import { ValidationError, ConflictError, NotFoundError } from "../../../domain/shared/errors";
import { requireUuid, slugify } from "../../../domain/shared/guards";
import { Product, type ImportRow } from "../../../domain/catalog/Product";
import { createBrand } from "../../../domain/catalog/Brand";
import { StoreStatus } from "../../../domain/stores/Store";
import { assertCan, type UseCaseContext } from "../../shared/authorize";
import type { Cache, IdGenerator, Row, UnitOfWork } from "../../shared/contracts";

export const MAX_IMPORT = 500;
/**
 * Görsel sütunu boş bırakılan satırlar için yer tutucu.
 *
 * Burada bir dizüstü fotoğrafı duruyordu: mouse ya da kulaklık aktaran bir
 * mağaza, ürünlerini yanlış fotoğrafla yayına almış oluyordu. Nötr bir yer
 * tutucu "fotoğraf henüz yok" der, yanlış bir şey söylemez — mağaza ürünü
 * yayına alırken kendi fotoğrafını yükler.
 */
const DEFAULT_IMAGE = "/images/urun-gorseli-yok.svg";

export class ImportProductsCommand extends Command {
  readonly storeId: string;
  readonly rows: readonly ImportRow[] | undefined;

  constructor(input?: { storeId?: string; rows?: readonly ImportRow[] }) {
    super();
    this.storeId = input?.storeId as string;
    this.rows = input?.rows;
  }
}

export interface ImportProductsResult {
  readonly count: number;
}

/**
 * CSV ile toplu ürün ekleme. Hepsi ya eklenir ya hiçbiri: tek satır hatalıysa
 * transaction geri alınır ve mağaza yarım bir katalogla kalmaz.
 * İçe aktarılan ürünler taslak olarak gelir, mağaza gözden geçirip yayınlar.
 */
export class ImportProductsHandler implements Handler<ImportProductsCommand, ImportProductsResult, UseCaseContext> {
  private readonly unitOfWork: UnitOfWork;
  private readonly cache: Cache;
  private readonly ids: IdGenerator;

  constructor({ unitOfWork, cache, ids }: { unitOfWork: UnitOfWork; cache: Cache; ids: IdGenerator }) {
    this.unitOfWork = unitOfWork;
    this.cache = cache;
    this.ids = ids;
  }

  async handle({ storeId, rows }: ImportProductsCommand, context: UseCaseContext = {}): Promise<ImportProductsResult> {
    requireUuid(storeId, "Mağaza numarası");
    assertCan(context, "catalog:product:write", { storeId });

    if (!Array.isArray(rows) || rows.length === 0) {
      throw new ValidationError("İçe aktarılacak ürün bulunamadı.");
    }
    if (rows.length > MAX_IMPORT) {
      throw new ValidationError(`Tek seferde en fazla ${MAX_IMPORT} ürün içe aktarabilirsiniz.`);
    }

    // CSV'de ilk satır başlık olduğundan veri satırları 2'den başlar.
    const products = rows.map((row, index) =>
      Product.fromImportRow(row, index + 2, { storeId, imageUrl: DEFAULT_IMAGE })
    );

    const count = await this.unitOfWork.run(async (repos) => {
      const store = await repos.stores.findById(storeId);
      if (!store) throw new NotFoundError("Mağaza bulunamadı.");
      if (store.status !== StoreStatus.ACTIVE) {
        throw new ConflictError("Mağaza onaylanmadan ürün eklenemez.");
      }

      /**
       * Kategori adını/slug'ını kimliğe çevirir.
       *
       * Boş bırakılabilir — o zaman ürün kategorisiz kalır. Ama YAZILMIŞ da
       * tanınmıyorsa içe aktarma durur: sessizce kategorisiz eklemek,
       * kullanıcının ürünü kategori filtresinde boşuna aramasına yol açardı.
       * İçe aktarma zaten hep-ya-hiç çalışıyor, bu da aynı çizgide.
       *
       * Aynı kategori birçok satırda geçtiği için sonuçlar not ediliyor.
       */
      const kategoriKimlikleri = new Map<string, string | null>();
      const kategoriKimligi = async (deger: unknown, satirNo: number): Promise<string | null> => {
        if (typeof deger !== "string" || !deger.trim()) return null;
        const slug = slugify(deger);
        if (kategoriKimlikleri.has(slug)) return kategoriKimlikleri.get(slug) ?? null;

        const kategori = await repos.categories.findBySlug(slug);
        if (!kategori) {
          throw new ValidationError(`${satirNo}. satır: "${deger.trim()}" diye bir kategori yok.`);
        }
        kategoriKimlikleri.set(slug, kategori.id);
        return kategori.id;
      };

      /**
       * Marka adını kimliğe çevirir; katalogda yoksa AÇAR.
       *
       * Kategoriden farklı davranıyor, bilerek: kategori vitrinin iskeleti
       * (filtreler, ana sayfa), yanlış yazılmış bir kategori ürünü
       * kaybettirir. Marka ise üreticinin adı; mağaza "Kingston" yazdıysa
       * Kingston'ı kastediyor. Ürün formundaki "yeni marka ekle" ile aynı
       * kural: aynı kısa adla marka varsa o kullanılır ("KINGSTON" =
       * "Kingston"), yoksa onaysız yeni marka açılır. Boşsa ürün markasız.
       */
      const markaKimlikleri = new Map<string, string>();
      const markaKimligi = async (deger: unknown, satirNo: number): Promise<string | null> => {
        if (typeof deger !== "string" || !deger.trim()) return null;
        let marka;
        try {
          marka = createBrand({ name: deger.trim() });
        } catch (error) {
          throw new ValidationError(`${satirNo}. satır: ${error instanceof Error ? error.message : String(error)}`);
        }
        const bilinen = markaKimlikleri.get(marka.slug);
        if (bilinen) return bilinen;

        const kayit =
          (await repos.brands.findBySlug(marka.slug)) ??
          (await repos.brands.create({ id: this.ids.uuid(), ...marka })) ??
          (await repos.brands.findBySlug(marka.slug));
        markaKimlikleri.set(marka.slug, kayit!.id as string);
        return kayit!.id as string;
      };

      const prepared: Row[] = [];
      for (const [index, product] of products.entries()) {
        prepared.push({
          ...product,
          id: this.ids.uuid(),
          categoryId: await kategoriKimligi(rows[index]?.category, index + 2),
          brandId: await markaKimligi(rows[index]?.brand, index + 2),
          slug: await repos.products.reserveSlug(storeId, product.slug)
        });
      }
      return repos.products.createMany(prepared);
    });

    await this.cache.deleteByPrefix("catalog:");
    return { count };
  }
}
