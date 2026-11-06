"use strict";

import { Command, type Handler } from "../../shared/cqrs/Message";
import { NotFoundError } from "../../../domain/shared/errors";
import { requireUuid } from "../../../domain/shared/guards";
import { ProductStatus } from "../../../domain/catalog/Product";
import { assertCan, type UseCaseContext } from "../../shared/authorize";
import type { Cache, UnitOfWork } from "../../shared/contracts";

export class DeleteProductCommand extends Command {
  readonly storeId: string;
  readonly productId: string;

  constructor(input?: { storeId?: string; productId?: string }) {
    super();
    this.storeId = input?.storeId as string;
    this.productId = input?.productId as string;
  }
}

/** Silindi mi, yoksa arşivlendi mi? */
export interface DeleteProductResult {
  readonly archived: boolean;
}

/**
 * Hiç satılmamış ürünü siler. Siparişlerde geçen ürün silinmez, arşivlenir;
 * böylece eski siparişlerin ürün bağlantısı kopmaz.
 */
export class DeleteProductHandler implements Handler<DeleteProductCommand, DeleteProductResult, UseCaseContext> {
  private readonly unitOfWork: UnitOfWork;
  private readonly cache: Cache;

  constructor({ unitOfWork, cache }: { unitOfWork: UnitOfWork; cache: Cache }) {
    this.unitOfWork = unitOfWork;
    this.cache = cache;
  }

  async handle(
    { storeId, productId }: DeleteProductCommand,
    context: UseCaseContext = {}
  ): Promise<DeleteProductResult> {
    requireUuid(storeId, "Mağaza numarası");
    requireUuid(productId, "Ürün numarası");
    assertCan(context, "catalog:product:delete", { storeId });

    const result = await this.unitOfWork.run(async (repos) => {
      if (await repos.products.isReferencedByOrders(productId)) {
        const archived = await repos.products.setStatus(storeId, productId, ProductStatus.ARCHIVED);
        if (!archived) throw new NotFoundError("Ürün bulunamadı.");
        return { archived: true };
      }
      const removed = await repos.products.remove(storeId, productId);
      if (!removed) throw new NotFoundError("Ürün bulunamadı.");
      await repos.audit.record({
        actorId: context.actorId ?? null,
        action: "product.deleted",
        resourceType: "product",
        resourceId: productId,
        context
      });
      return { archived: false };
    });

    await this.cache.deleteByPrefix("catalog:");
    return result;
  }
}
