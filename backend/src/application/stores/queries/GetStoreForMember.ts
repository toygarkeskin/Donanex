"use strict";

import { Query, type Handler } from "../../shared/cqrs/Message";
import { NotFoundError } from "../../../domain/shared/errors";
import { assertCan, type UseCaseContext } from "../../shared/authorize";
import type { Row, StoreReadModel } from "../../shared/contracts";

export class GetStoreForMemberQuery extends Query {
  readonly storeId: string;

  constructor(input?: { storeId?: string }) {
    super();
    this.storeId = input?.storeId as string;
  }
}

/** Mağaza paneli başlığı: yalnızca o mağazada yetkisi olan kişi görebilir. */
export class GetStoreForMemberHandler implements Handler<GetStoreForMemberQuery, Row, UseCaseContext> {
  private readonly readModel: StoreReadModel;

  constructor({ storeReadModel }: { storeReadModel: StoreReadModel }) {
    this.readModel = storeReadModel;
  }

  async handle({ storeId }: GetStoreForMemberQuery, context: UseCaseContext = {}): Promise<Row> {
    assertCan(context, "store:read", { storeId });
    const store = await this.readModel.getForMember(storeId);
    if (!store) throw new NotFoundError("Mağaza bulunamadı.");
    return store;
  }
}
