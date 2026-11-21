"use strict";

import { Command, type Handler } from "../../shared/cqrs/Message";
import { requireUuid } from "../../../domain/shared/guards";
import { createBrand } from "../../../domain/catalog/Brand";
import { assertCan, type UseCaseContext } from "../../shared/authorize";
import type { Cache, IdGenerator, Row, UnitOfWork } from "../../shared/contracts";

export class AddStoreBrandCommand extends Command {
  readonly storeId: string;
  readonly name: unknown;

  constructor(input?: { storeId?: string; name?: unknown }) {
    super();
    this.storeId = input?.storeId as string;
    this.name = input?.name;
  }
}

export interface AddedBrand {
  readonly brand: Row;
  /** false: bu adla bir marka zaten vardı, o döndürüldü. */
  readonly created: boolean;
}

/**
 * Mağazanın ürün formundan yeni marka eklemesi ("Kingston" listede yoksa).
 *
 * Önceden markalar yalnızca demo verisinden geliyordu ve sonradan
 * eklenemiyordu: listede olmayan markanın ürünü markasız kalıyor, ürün
 * sayfasında marka bağlantısı çıkmıyor, marka sayfasında görünmüyordu.
 *
 * Kategorideki gibi "BUL YA DA OLUŞTUR": aynı kısa adla marka varsa yenisi
 * açılmıyor, mevcut olan döndürülüyor ("KINGSTON" ve "Kingston" tek marka).
 * Mağazanın açtığı marka ONAYSIZ (verified = false) başlıyor; "onaylı marka"
 * işaretini yalnızca yönetim verebilir. Markalar sayfası zaten yalnızca
 * satışta ürünü olan markaları gösteriyor, boş marka vitrine çıkmıyor.
 * Kimin açtığı denetim kaydında duruyor.
 */
export class AddStoreBrandHandler implements Handler<AddStoreBrandCommand, AddedBrand, UseCaseContext> {
  private readonly unitOfWork: UnitOfWork;
  private readonly cache: Cache;
  private readonly ids: IdGenerator;

  constructor({ unitOfWork, cache, ids }: { unitOfWork: UnitOfWork; cache: Cache; ids: IdGenerator }) {
    this.unitOfWork = unitOfWork;
    this.cache = cache;
    this.ids = ids;
  }

  async handle({ storeId, name }: AddStoreBrandCommand, context: UseCaseContext = {}): Promise<AddedBrand> {
    requireUuid(storeId, "Mağaza numarası");
    assertCan(context, "catalog:product:write", { storeId });
    const brand = createBrand({ name: typeof name === "string" ? name.trim() : name });

    const sonuc = await this.unitOfWork.run(async (repos) => {
      const mevcut = await repos.brands.findBySlug(brand.slug);
      if (mevcut) return { brand: mevcut, created: false };

      const yeni = await repos.brands.create({ id: this.ids.uuid(), ...brand });
      // Aynı anda başka bir mağaza aynı adı eklediyse: oluşturma çakışır, onu döndür.
      if (!yeni) return { brand: (await repos.brands.findBySlug(brand.slug)) as Row, created: false };

      await repos.audit.record({
        actorId: context.actorId ?? null,
        action: "catalog.brand_added_by_store",
        resourceType: "brand",
        resourceId: yeni.id,
        metadata: { storeId, name: brand.name },
        context
      });
      return { brand: yeni, created: true };
    });

    if (sonuc.created) await this.cache.deleteByPrefix("catalog:");
    return sonuc;
  }
}
