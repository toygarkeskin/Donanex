"use strict";

import { Command, type Handler } from "../../shared/cqrs/Message";
import { NotFoundError } from "../../../domain/shared/errors";
import { requireUuid, requireEnum } from "../../../domain/shared/guards";
import { ProductStatus, type ProductStatusKind } from "../../../domain/catalog/Product";
import { assertCan, type UseCaseContext } from "../../shared/authorize";
import type { Cache, Row, UnitOfWork } from "../../shared/contracts";

export class SetProductStatusCommand extends Command {
  readonly storeId: string;
  readonly productId: string;
  readonly status: ProductStatusKind;

  constructor(input?: { storeId?: string; productId?: string; status?: unknown }) {
    super();
    this.storeId = input?.storeId as string;
    this.productId = input?.productId as string;
    this.status = input?.status as ProductStatusKind;
  }
}

/**
 * Ürünü yayına alır, taslağa çeker ya da arşivler.
 *
 * Geçmiş siparişlerde geçen ürün SİLİNMEZ, arşivlenir: sipariş kayıtlarının
 * ürün adı ve fiyatı zaten sipariş satırında saklandığı için geçmiş bozulmaz,
 * ama ürün kaydı da referans bütünlüğünü koruyarak yerinde kalır.
 */
export class SetProductStatusHandler implements Handler<SetProductStatusCommand, Row, UseCaseContext> {
  private readonly unitOfWork: UnitOfWork;
  private readonly cache: Cache;

  constructor({ unitOfWork, cache }: { unitOfWork: UnitOfWork; cache: Cache }) {
    this.unitOfWork = unitOfWork;
    this.cache = cache;
  }

  async handle(
    { storeId, productId, status }: SetProductStatusCommand,
    context: UseCaseContext = {}
  ): Promise<Row> {
    requireUuid(storeId, "Mağaza numarası");
    requireUuid(productId, "Ürün numarası");
    requireEnum(status, Object.values(ProductStatus) as ProductStatusKind[], "Ürün durumu");
    assertCan(context, "catalog:product:write", { storeId });

    const result = await this.unitOfWork.run(async (repos) => {
      const updated = await repos.products.setStatus(storeId, productId, status);
      if (!updated) throw new NotFoundError("Ürün bulunamadı.");
      await repos.audit.record({
        actorId: context.actorId ?? null,
        action: `product.${status}`,
        resourceType: "product",
        resourceId: productId,
        context
      });
      return updated;
    });

    await this.cache.deleteByPrefix("catalog:");
    return result;
  }
}
