"use strict";

import { Query, type Handler } from "../../shared/cqrs/Message";
import type { Row, UserReadModel } from "../../shared/contracts";

export interface UserFilters {
  q?: unknown;
  role?: unknown;
  status?: unknown;
  page?: unknown;
  pageSize?: unknown;
}

export class ListUsersQuery extends Query {
  readonly filters: UserFilters;

  constructor(filters: UserFilters = {}) {
    super();
    this.filters = filters;
  }
}

export class ListUsersHandler implements Handler<ListUsersQuery, Row> {
  private readonly readModel: UserReadModel;

  constructor({ userReadModel }: { userReadModel: UserReadModel }) {
    this.readModel = userReadModel;
  }

  handle({ filters }: ListUsersQuery): Promise<Row> {
    const page = Number.isInteger(Number(filters.page)) && Number(filters.page) > 0 ? Number(filters.page) : 1;
    const pageSize = Math.min(100, Math.max(1, Number(filters.pageSize) || 20));
    return this.readModel.listForAdmin({
      search: typeof filters.q === "string" ? filters.q.trim().slice(0, 100) : "",
      role: typeof filters.role === "string" ? filters.role : null,
      status: typeof filters.status === "string" ? filters.status : null,
      limit: pageSize,
      offset: (page - 1) * pageSize,
      page,
      pageSize
    });
  }
}
