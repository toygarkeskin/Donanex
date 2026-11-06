"use strict";

import { Query, type Handler } from "../../shared/cqrs/Message";
import { assertCan, type UseCaseContext } from "../../shared/authorize";
import type { Row, StoreReadModel } from "../../shared/contracts";

export class ListStoreMembersQuery extends Query {
  readonly storeId: string;

  constructor(input?: { storeId?: string }) {
    super();
    this.storeId = input?.storeId as string;
  }
}

export class ListStoreMembersHandler implements Handler<ListStoreMembersQuery, Row[], UseCaseContext> {
  private readonly readModel: StoreReadModel;

  constructor({ storeReadModel }: { storeReadModel: StoreReadModel }) {
    this.readModel = storeReadModel;
  }

  handle({ storeId }: ListStoreMembersQuery, context: UseCaseContext = {}): Promise<Row[]> {
    assertCan(context, "store:member:manage", { storeId });
    return this.readModel.listMembers(storeId);
  }
}
