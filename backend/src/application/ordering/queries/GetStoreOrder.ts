"use strict";

import { Query, type Handler } from "../../shared/cqrs/Message";
import { NotFoundError } from "../../../domain/shared/errors";
import { requireUuid } from "../../../domain/shared/guards";
import { assertCan, type UseCaseContext } from "../../shared/authorize";
import type { OrderReadModel, Row } from "../../shared/contracts";

export class GetStoreOrderQuery extends Query {
  readonly storeId: string;
  readonly packageId: string;

  constructor(input?: { storeId?: string; packageId?: string }) {
    super();
    this.storeId = input?.storeId as string;
    this.packageId = input?.packageId as string;
  }
}

export class GetStoreOrderHandler implements Handler<GetStoreOrderQuery, Row, UseCaseContext> {
  private readonly readModel: OrderReadModel;

  constructor({ orderReadModel }: { orderReadModel: OrderReadModel }) {
    this.readModel = orderReadModel;
  }

  async handle({ storeId, packageId }: GetStoreOrderQuery, context: UseCaseContext = {}): Promise<Row> {
    requireUuid(storeId, "Mağaza numarası");
    requireUuid(packageId, "Paket numarası");
    assertCan(context, "order:read", { storeId });

    const pkg = await this.readModel.getForStore(packageId, storeId);
    if (!pkg) throw new NotFoundError("Paket bulunamadı.");
    return pkg;
  }
}
