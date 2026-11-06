"use strict";

import { Command, type Handler } from "../../shared/cqrs/Message";
import { NotFoundError } from "../../../domain/shared/errors";
import { requireUuid } from "../../../domain/shared/guards";
import { Product, type ProductInput } from "../../../domain/catalog/Product";
import { assertCan, type UseCaseContext } from "../../shared/authorize";
import type { Cache, Row, UnitOfWork } from "../../shared/contracts";

export class UpdateProductCommand extends Command {
  readonly storeId: string;
  readonly productId: string;
  readonly data: ProductInput | undefined;

  constructor(input?: { storeId?: string; productId?: string; data?: ProductInput }) {
    super();
    this.storeId = input?.storeId as string;
    this.productId = input?.productId as string;
    this.data = input?.data;
  }
}

export class UpdateProductHandler implements Handler<UpdateProductCommand, Row, UseCaseContext> {
  private readonly unitOfWork: UnitOfWork;
  private readonly cache: Cache;

  constructor({ unitOfWork, cache }: { unitOfWork: UnitOfWork; cache: Cache }) {
    this.unitOfWork = unitOfWork;
    this.cache = cache;
  }

  async handle({ storeId, productId, data }: UpdateProductCommand, context: UseCaseContext = {}): Promise<Row> {
    requireUuid(storeId, "Mağaza numarası");
    requireUuid(productId, "Ürün numarası");
    assertCan(context, "catalog:product:write", { storeId });

    const product = Product.create({ ...data, id: productId, storeId });

    const saved = await this.unitOfWork.run(async (repos) => {
      // storeId sorgunun parçası: başka mağazanın ürünü güncellenemez.
      const updated = await repos.products.update(storeId, product as unknown as Row);
      if (!updated) throw new NotFoundError("Ürün bulunamadı.");
      await repos.audit.record({
        actorId: context.actorId ?? null,
        action: "product.updated",
        resourceType: "product",
        resourceId: productId,
        context
      });
      return updated;
    });

    await this.cache.deleteByPrefix("catalog:");
    return saved;
  }
}
