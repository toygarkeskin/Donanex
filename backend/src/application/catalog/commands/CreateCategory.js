"use strict";

const { Command } = require("../../shared/cqrs/Message");
const { ConflictError } = require("../../../domain/shared/errors");
const { createCategory } = require("../../../domain/catalog/Category");
const { assertCan } = require("../../shared/authorize");

class CreateCategoryCommand extends Command {
  constructor(input) {
    super();
    this.data = input?.data;
  }
}

class CreateCategoryHandler {
  constructor({ unitOfWork, cache, ids }) {
    this.unitOfWork = unitOfWork;
    this.cache = cache;
    this.ids = ids;
  }

  async handle({ data }, context = {}) {
    assertCan(context, "catalog:category:manage");
    const category = createCategory(data);

    const saved = await this.unitOfWork.run(async ({ categories }) => {
      const created = await categories.create({ id: this.ids.uuid(), ...category });
      if (!created) throw new ConflictError("Bu kategori zaten var.");
      return created;
    });

    await this.cache.deleteByPrefix("catalog:");
    return saved;
  }
}

module.exports = { CreateCategoryCommand, CreateCategoryHandler };
