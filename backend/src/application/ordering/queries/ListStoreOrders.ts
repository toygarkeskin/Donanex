"use strict";

import { Query, type Handler } from "../../shared/cqrs/Message";
import { requireUuid } from "../../../domain/shared/guards";
import { isPackageStatus } from "../../../domain/ordering/OrderStatus";
import { assertCan, type UseCaseContext } from "../../shared/authorize";
import type { OrderReadModel, Row } from "../../shared/contracts";

export interface StoreOrderFilters {
  q?: unknown;
  status?: unknown;
  from?: unknown;
  to?: unknown;
  page?: unknown;
  pageSize?: unknown;
}

export class ListStoreOrdersQuery extends Query {
  readonly storeId: string;
  readonly filters: StoreOrderFilters;

  constructor(input?: { storeId?: string; filters?: StoreOrderFilters }) {
    super();
    this.storeId = input?.storeId as string;
    this.filters = input?.filters ?? {};
  }
}

/** Mağaza paneli: yalnızca o mağazaya düşen paketler listelenir. */
export class ListStoreOrdersHandler implements Handler<ListStoreOrdersQuery, Row, UseCaseContext> {
  private readonly readModel: OrderReadModel;

  constructor({ orderReadModel }: { orderReadModel: OrderReadModel }) {
    this.readModel = orderReadModel;
  }

  handle({ storeId, filters }: ListStoreOrdersQuery, context: UseCaseContext = {}): Promise<Row> {
    requireUuid(storeId, "Mağaza numarası");
    assertCan(context, "order:read", { storeId });

    const page = Math.max(1, Number(filters.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(filters.pageSize) || 20));
    const date = (value: unknown): string | null =>
      typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;

    return this.readModel.listForStore(storeId, {
      search: typeof filters.q === "string" ? filters.q.trim().slice(0, 100) : "",
      status: isPackageStatus(filters.status) ? filters.status : null,
      from: date(filters.from),
      to: date(filters.to),
      limit: pageSize,
      offset: (page - 1) * pageSize,
      page,
      pageSize
    });
  }
}
