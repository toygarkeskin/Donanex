"use strict";

import { Command, type Handler } from "../../shared/cqrs/Message";
import { ValidationError, ConflictError, NotFoundError } from "../../../domain/shared/errors";
import { requireUuid } from "../../../domain/shared/guards";
import { Product, type ImportRow } from "../../../domain/catalog/Product";
import { StoreStatus } from "../../../domain/stores/Store";
import { assertCan, type UseCaseContext } from "../../shared/authorize";
import type { Cache, IdGenerator, Row, UnitOfWork } from "../../shared/contracts";

export const MAX_IMPORT = 500;
const DEFAULT_IMAGE = "/images/urunler/laptopcard.png";

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

      const prepared: Row[] = [];
      for (const product of products) {
        prepared.push({
          ...product,
          id: this.ids.uuid(),
          slug: await repos.products.reserveSlug(storeId, product.slug)
        });
      }
      return repos.products.createMany(prepared);
    });

    await this.cache.deleteByPrefix("catalog:");
    return { count };
  }
}
