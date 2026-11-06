"use strict";

import { Query, type Handler } from "../../shared/cqrs/Message";
import type { OrderReadModel, Row } from "../../shared/contracts";

export interface OrderFilters {
  page?: unknown;
  pageSize?: unknown;
}

export class ListMyOrdersQuery extends Query {
  readonly userId: string;
  readonly filters: OrderFilters;

  constructor(input?: { userId?: string; filters?: OrderFilters }) {
    super();
    this.userId = input?.userId as string;
    this.filters = input?.filters ?? {};
  }
}

export class ListMyOrdersHandler implements Handler<ListMyOrdersQuery, Row> {
  private readonly readModel: OrderReadModel;

  constructor({ orderReadModel }: { orderReadModel: OrderReadModel }) {
    this.readModel = orderReadModel;
  }

  handle({ userId, filters }: ListMyOrdersQuery): Promise<Row> {
    const page = Math.max(1, Number(filters.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(filters.pageSize) || 10));
    return this.readModel.listForUser(userId, { limit: pageSize, offset: (page - 1) * pageSize, page, pageSize });
  }
}
