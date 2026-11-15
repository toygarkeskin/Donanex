"use strict";

import { Query, type Handler } from "../../shared/cqrs/Message";
import { requireUuid } from "../../../domain/shared/guards";
import type { FeedbackReadModel, Row } from "../../shared/contracts";

export class ListQuestionsQuery extends Query {
  readonly productId: string;
  readonly filters: { page?: unknown; pageSize?: unknown };

  constructor(input?: { productId?: string; filters?: { page?: unknown; pageSize?: unknown } }) {
    super();
    this.productId = input?.productId as string;
    this.filters = input?.filters ?? {};
  }
}

/** Ürün soruları ve yanıtları — herkese açık. */
export class ListQuestionsHandler implements Handler<ListQuestionsQuery, Row> {
  private readonly readModel: FeedbackReadModel;

  constructor({ feedbackReadModel }: { feedbackReadModel: FeedbackReadModel }) {
    this.readModel = feedbackReadModel;
  }

  handle({ productId, filters }: ListQuestionsQuery): Promise<Row> {
    requireUuid(productId, "Ürün numarası");
    const page = Math.max(1, Number(filters.page) || 1);
    const pageSize = Math.min(30, Math.max(1, Number(filters.pageSize) || 5));
    return this.readModel.listQuestions(productId, { limit: pageSize, offset: (page - 1) * pageSize, page, pageSize });
  }
}
