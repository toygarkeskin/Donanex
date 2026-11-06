"use strict";

import { Query, type Handler } from "../../shared/cqrs/Message";
import { requireUuid } from "../../../domain/shared/guards";
import { assertCan, type UseCaseContext } from "../../shared/authorize";
import type { CatalogReadModel, Row } from "../../shared/contracts";

export interface StoreProductFilters {
  q?: unknown;
  status?: unknown;
  page?: unknown;
  pageSize?: unknown;
}

export class ListStoreProductsQuery extends Query {
  readonly storeId: string;
  readonly filters: StoreProductFilters;

  constructor(input?: { storeId?: string; filters?: StoreProductFilters }) {
    super();
    this.storeId = input?.storeId as string;
    this.filters = input?.filters ?? {};
  }
}

/** Mağaza panelindeki ürün listesi: taslak ve arşivli ürünler de görünür. */
export class ListStoreProductsHandler implements Handler<ListStoreProductsQuery, Row, UseCaseContext> {
  private readonly readModel: CatalogReadModel;

  constructor({ catalogReadModel }: { catalogReadModel: CatalogReadModel }) {
    this.readModel = catalogReadModel;
  }

  handle({ storeId, filters }: ListStoreProductsQuery, context: UseCaseContext = {}): Promise<Row> {
    requireUuid(storeId, "Mağaza numarası");
    assertCan(context, "catalog:product:read", { storeId });

    const page = Math.max(1, Number(filters.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(filters.pageSize) || 20));
    return this.readModel.listStoreProducts(storeId, {
      search: typeof filters.q === "string" ? filters.q.trim().slice(0, 100) : "",
      status: typeof filters.status === "string" ? filters.status : null,
      limit: pageSize,
      offset: (page - 1) * pageSize,
      page,
      pageSize
    });
  }
}
