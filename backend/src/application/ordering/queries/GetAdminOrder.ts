"use strict";

import { Query, type Handler } from "../../shared/cqrs/Message";
import { NotFoundError } from "../../../domain/shared/errors";
import { requireUuid } from "../../../domain/shared/guards";
import { assertCan, type UseCaseContext } from "../../shared/authorize";
import type { OrderReadModel, Row } from "../../shared/contracts";

export class GetAdminOrderQuery extends Query {
  readonly orderId: string;

  constructor(input?: { orderId?: string }) {
    super();
    this.orderId = input?.orderId as string;
  }
}

export class GetAdminOrderHandler implements Handler<GetAdminOrderQuery, Row, UseCaseContext> {
  private readonly readModel: OrderReadModel;

  constructor({ orderReadModel }: { orderReadModel: OrderReadModel }) {
    this.readModel = orderReadModel;
  }

  async handle({ orderId }: GetAdminOrderQuery, context: UseCaseContext = {}): Promise<Row> {
    // Kapsamsız sorulur: bu izin yalnızca sistem geneli bir rolle kazanılır.
    assertCan(context, "order:read");
    requireUuid(orderId, "Sipariş numarası");
    const order = await this.readModel.getForAdmin(orderId);
    if (!order) throw new NotFoundError("Sipariş bulunamadı.");
    return order;
  }
}
