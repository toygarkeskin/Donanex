"use strict";

import { Query, type Handler } from "../../shared/cqrs/Message";
import type { Row, UserReadModel } from "../../shared/contracts";

export class ListAddressesQuery extends Query {
  readonly userId: string;

  constructor(input?: { userId?: string }) {
    super();
    this.userId = input?.userId as string;
  }
}

export class ListAddressesHandler implements Handler<ListAddressesQuery, Row[]> {
  private readonly readModel: UserReadModel;

  constructor({ userReadModel }: { userReadModel: UserReadModel }) {
    this.readModel = userReadModel;
  }

  handle({ userId }: ListAddressesQuery): Promise<Row[]> {
    return this.readModel.listAddresses(userId);
  }
}
