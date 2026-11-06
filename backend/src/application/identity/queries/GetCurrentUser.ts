"use strict";

import { Query, type Handler } from "../../shared/cqrs/Message";
import type { UseCaseContext } from "../../shared/authorize";
import type { Row, StoreReadModel, UserReadModel } from "../../shared/contracts";

export class GetCurrentUserQuery extends Query {
  readonly userId: string;

  constructor(input?: { userId?: string }) {
    super();
    this.userId = input?.userId as string;
  }
}

/** Arayüzün açılışta çağırdığı "ben kimim" ucu: profil + roller + menü yetkileri. */
export class GetCurrentUserHandler implements Handler<GetCurrentUserQuery, Row | null, UseCaseContext> {
  private readonly users: UserReadModel;
  private readonly stores: StoreReadModel;

  constructor({ userReadModel, storeReadModel }: { userReadModel: UserReadModel; storeReadModel: StoreReadModel }) {
    this.users = userReadModel;
    this.stores = storeReadModel;
  }

  async handle({ userId }: GetCurrentUserQuery, context: UseCaseContext = {}): Promise<Row | null> {
    const profile = await this.users.getProfile(userId);
    if (!profile) return null;

    const policy = context.policy;
    const stores = policy && policy.storeIds.length ? await this.stores.listForMember(policy.storeIds) : [];

    return {
      ...profile,
      roles: policy ? policy.roleCodes : [],
      isSystemAdmin: policy ? policy.isSystemAdmin() : false,
      stores
    };
  }
}
