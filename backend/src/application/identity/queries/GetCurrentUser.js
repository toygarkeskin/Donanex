"use strict";

const { Query } = require("../../shared/cqrs/Message");

class GetCurrentUserQuery extends Query {
  constructor(input) {
    super();
    this.userId = input?.userId;
  }
}

/** Arayüzün açılışta çağırdığı "ben kimim" ucu: profil + roller + menü yetkileri. */
class GetCurrentUserHandler {
  constructor({ userReadModel, storeReadModel }) {
    this.users = userReadModel;
    this.stores = storeReadModel;
  }

  async handle({ userId }, context = {}) {
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

module.exports = { GetCurrentUserQuery, GetCurrentUserHandler };
