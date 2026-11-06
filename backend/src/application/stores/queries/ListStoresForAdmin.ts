"use strict";

import { Query, type Handler } from "../../shared/cqrs/Message";
import { assertCan, type UseCaseContext } from "../../shared/authorize";
import type { Row, StoreReadModel } from "../../shared/contracts";

export interface AdminStoreFilters {
  q?: unknown;
  status?: unknown;
  page?: unknown;
  pageSize?: unknown;
}

export class ListStoresForAdminQuery extends Query {
  readonly filters: AdminStoreFilters;

  constructor(filters: AdminStoreFilters = {}) {
    super();
    this.filters = filters;
  }
}

export class ListStoresForAdminHandler implements Handler<ListStoresForAdminQuery, Row, UseCaseContext> {
  private readonly readModel: StoreReadModel;

  constructor({ storeReadModel }: { storeReadModel: StoreReadModel }) {
    this.readModel = storeReadModel;
  }

  handle({ filters }: ListStoresForAdminQuery, context: UseCaseContext = {}): Promise<Row> {
    assertCan(context, "store:approve");
    const page = Math.max(1, Number(filters.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(filters.pageSize) || 20));
    return this.readModel.listForAdmin({
      search: typeof filters.q === "string" ? filters.q.trim().slice(0, 100) : "",
      status: typeof filters.status === "string" ? filters.status : null,
      limit: pageSize,
      offset: (page - 1) * pageSize,
      page,
      pageSize
    });
  }
}
