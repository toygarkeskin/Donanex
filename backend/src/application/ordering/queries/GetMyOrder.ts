"use strict";

import { Query, type Handler } from "../../shared/cqrs/Message";
import { NotFoundError } from "../../../domain/shared/errors";
import { requireUuid } from "../../../domain/shared/guards";
import type { OrderReadModel, Row } from "../../shared/contracts";

export class GetMyOrderQuery extends Query {
  readonly userId: string;
  readonly orderId: string;

  constructor(input?: { userId?: string; orderId?: string }) {
    super();
    this.userId = input?.userId as string;
    this.orderId = input?.orderId as string;
  }
}

export class GetMyOrderHandler implements Handler<GetMyOrderQuery, Row> {
  private readonly readModel: OrderReadModel;

  constructor({ orderReadModel }: { orderReadModel: OrderReadModel }) {
    this.readModel = orderReadModel;
  }

  async handle({ userId, orderId }: GetMyOrderQuery): Promise<Row> {
    requireUuid(orderId, "Sipariş numarası");
    // Kullanıcı kimliği sorgunun parçası: başkasının siparişi görülemez.
    const order = await this.readModel.getForUser(orderId, userId);
    if (!order) throw new NotFoundError("Sipariş bulunamadı.");
    return order;
  }
}
