"use strict";

import { Command, type Handler } from "../../shared/cqrs/Message";
import { requireUuid } from "../../../domain/shared/guards";
import { createCategory } from "../../../domain/catalog/Category";
import { assertCan, type UseCaseContext } from "../../shared/authorize";
import type { Cache, IdGenerator, Row, UnitOfWork } from "../../shared/contracts";

export class AddStoreCategoryCommand extends Command {
  readonly storeId: string;
  readonly name: unknown;

  constructor(input?: { storeId?: string; name?: unknown }) {
    super();
    this.storeId = input?.storeId as string;
    this.name = input?.name;
  }
}

export interface AddedCategory {
  readonly category: Row;
  /** false: bu adla bir kategori zaten vardı, o döndürüldü. */
  readonly created: boolean;
}

/**
 * Mağazanın ürün formundan yeni kategori eklemesi ("RAM" listede yoksa).
 *
 * Önceden kategori yalnızca yönetim panelinden eklenebiliyordu; RAM satmak
 * isteyen mağaza ürünü yanlış bir kategoriye koymak ya da kategorisiz
 * bırakmak zorunda kalıyordu.
 *
 * "BUL YA DA OLUŞTUR": aynı adla (kısa adı aynı olan) kategori zaten varsa
 * yenisi açılmıyor, mevcut olan döndürülüyor. İki mağaza aynı gün "RAM" ve
 * "Ram" yazsa bile vitrinde tek bir RAM kategorisi oluyor. Hata vermek
 * yerine mevcut olanı döndürmek bilinçli: kullanıcının niyeti "RAM
 * kategorisini seçmek", "yeni bir kayıt açmak" değil.
 *
 * Yetki ürün yazma izni, mağaza kapsamında: ürün ekleyebilen ürününe
 * kategori de bulabilmeli. Kategoriler sistem genelinde paylaşıldığı için
 * bunun bedeli var — bir mağaza anlamsız bir kategori açabilir. Ama vitrin
 * yalnızca ÜRÜNÜ OLAN kategorileri gösteriyor; boş ya da kullanılmayan
 * kategori ana sayfada ve filtrelerde görünmüyor. Kim açtığı denetim
 * kaydında duruyor.
 */
export class AddStoreCategoryHandler implements Handler<AddStoreCategoryCommand, AddedCategory, UseCaseContext> {
  private readonly unitOfWork: UnitOfWork;
  private readonly cache: Cache;
  private readonly ids: IdGenerator;

  constructor({ unitOfWork, cache, ids }: { unitOfWork: UnitOfWork; cache: Cache; ids: IdGenerator }) {
    this.unitOfWork = unitOfWork;
    this.cache = cache;
    this.ids = ids;
  }

  async handle({ storeId, name }: AddStoreCategoryCommand, context: UseCaseContext = {}): Promise<AddedCategory> {
    requireUuid(storeId, "Mağaza numarası");
    assertCan(context, "catalog:product:write", { storeId });
    // Kısa ad (slug) her zaman addan türetiliyor: mağaza kendi kısa adını veremez.
    const category = createCategory({ name: typeof name === "string" ? name.trim() : name });

    const sonuc = await this.unitOfWork.run(async (repos) => {
      const mevcut = await repos.categories.findBySlug(category.slug);
      if (mevcut) return { category: mevcut, created: false };

      const yeni = await repos.categories.create({ id: this.ids.uuid(), ...category, parentId: null });
      // Aynı anda başka bir mağaza aynı adı eklediyse: oluşturma çakışır, onu döndür.
      if (!yeni) {
        const sonradan = await repos.categories.findBySlug(category.slug);
        return { category: sonradan as Row, created: false };
      }

      await repos.audit.record({
        actorId: context.actorId ?? null,
        action: "catalog.category_added_by_store",
        resourceType: "category",
        resourceId: yeni.id,
        metadata: { storeId, name: category.name },
        context
      });
      return { category: yeni, created: true };
    });

    if (sonuc.created) await this.cache.deleteByPrefix("catalog:");
    return sonuc;
  }
}
