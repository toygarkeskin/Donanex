"use strict";

import { Query, type Handler } from "../../shared/cqrs/Message";
import type { Row, StoreReadModel } from "../../shared/contracts";

export interface StoreFilters {
  q?: unknown;
  pageSize?: unknown;
}

export class ListStoresQuery extends Query {
  readonly filters: StoreFilters;

  constructor(filters: StoreFilters = {}) {
    super();
    this.filters = filters;
  }
}

/** Vitrindeki mağaza listesi — yalnızca onaylı ve aktif mağazalar. */
export class ListStoresHandler implements Handler<ListStoresQuery, Row> {
  private readonly readModel: StoreReadModel;

  constructor({ storeReadModel }: { storeReadModel: StoreReadModel }) {
    this.readModel = storeReadModel;
  }

  handle({ filters }: ListStoresQuery): Promise<Row> {
    return this.readModel.listPublic({
      search: typeof filters.q === "string" ? filters.q.trim().slice(0, 100) : "",
      limit: Math.min(100, Math.max(1, Number(filters.pageSize) || 50))
    });
  }
}
