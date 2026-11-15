"use strict";

import { Query, type Handler } from "../../shared/cqrs/Message";
import { requireUuid } from "../../../domain/shared/guards";
import type { FeedbackReadModel, Row } from "../../shared/contracts";

export class ListReviewsQuery extends Query {
  readonly productId: string;
  readonly filters: { page?: unknown; pageSize?: unknown };

  constructor(input?: { productId?: string; filters?: { page?: unknown; pageSize?: unknown } }) {
    super();
    this.productId = input?.productId as string;
    this.filters = input?.filters ?? {};
  }
}

/** Ürün yorumları ve puan özeti — herkese açık. */
export class ListReviewsHandler implements Handler<ListReviewsQuery, Row> {
  private readonly readModel: FeedbackReadModel;

  constructor({ feedbackReadModel }: { feedbackReadModel: FeedbackReadModel }) {
    this.readModel = feedbackReadModel;
  }

  handle({ productId, filters }: ListReviewsQuery): Promise<Row> {
    requireUuid(productId, "Ürün numarası");
    const page = Math.max(1, Number(filters.page) || 1);
    const pageSize = Math.min(30, Math.max(1, Number(filters.pageSize) || 5));
    return this.readModel.listReviews(productId, { limit: pageSize, offset: (page - 1) * pageSize, page, pageSize });
  }
}
