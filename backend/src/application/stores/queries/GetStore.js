"use strict";

const { Query } = require("../../shared/cqrs/Message");
const { NotFoundError } = require("../../../domain/shared/errors");

class GetStoreQuery extends Query {
  constructor(input) {
    super();
    this.slug = input?.slug;
  }
}

class GetStoreHandler {
  constructor({ storeReadModel }) {
    this.readModel = storeReadModel;
  }

  async handle({ slug }) {
    const store = await this.readModel.getBySlug(slug);
    if (!store) throw new NotFoundError("Mağaza bulunamadı.");
    return store;
  }
}

module.exports = { GetStoreQuery, GetStoreHandler };
