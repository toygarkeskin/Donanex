"use strict";

import { Command, type Handler } from "../../shared/cqrs/Message";
import { ConflictError, NotFoundError } from "../../../domain/shared/errors";
import { requireUuid } from "../../../domain/shared/guards";
import { Product, type ProductInput } from "../../../domain/catalog/Product";
import { StoreStatus } from "../../../domain/stores/Store";
import { assertCan, type UseCaseContext } from "../../shared/authorize";
import type { Cache, IdGenerator, Row, UnitOfWork } from "../../shared/contracts";

export class CreateProductCommand extends Command {
  readonly storeId: string;
  readonly data: ProductInput | undefined;

  constructor(input?: { storeId?: string; data?: ProductInput }) {
    super();
    this.storeId = input?.storeId as string;
    this.data = input?.data;
  }
}

export class CreateProductHandler implements Handler<CreateProductCommand, Row, UseCaseContext> {
  private readonly unitOfWork: UnitOfWork;
  private readonly cache: Cache;
  private readonly ids: IdGenerator;

  constructor({ unitOfWork, cache, ids }: { unitOfWork: UnitOfWork; cache: Cache; ids: IdGenerator }) {
    this.unitOfWork = unitOfWork;
    this.cache = cache;
    this.ids = ids;
  }

  async handle({ storeId, data }: CreateProductCommand, context: UseCaseContext = {}): Promise<Row> {
    requireUuid(storeId, "Mağaza numarası");
    assertCan(context, "catalog:product:write", { storeId });

    const product = Product.create({ ...data, id: this.ids.uuid(), storeId });

    const saved = await this.unitOfWork.run(async (repos) => {
      const store = await repos.stores.findById(storeId);
      if (!store) throw new NotFoundError("Mağaza bulunamadı.");
      if (store.status !== StoreStatus.ACTIVE) {
        throw new ConflictError("Mağaza onaylanmadan ürün eklenemez.");
      }
      // Aynı mağaza içinde adres (slug) benzersiz olmalı.
      const slug = await repos.products.reserveSlug(storeId, product.slug);
      const created = await repos.products.create({ ...product, slug });

      await repos.audit.record({
        actorId: context.actorId ?? null,
        action: "product.created",
        resourceType: "product",
        resourceId: created.id,
        context
      });
      return created;
    });

    // Stok ve katalog değişti: satılmış ürün bir süre "stokta" görünmesin.
    await this.cache.deleteByPrefix("catalog:");
    return saved;
  }
}
