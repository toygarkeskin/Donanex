"use strict";

import { Command, type Handler } from "../../shared/cqrs/Message";
import { ConflictError } from "../../../domain/shared/errors";
import { createCategory, type CategoryInput } from "../../../domain/catalog/Category";
import { assertCan, type UseCaseContext } from "../../shared/authorize";
import type { Cache, IdGenerator, Row, UnitOfWork } from "../../shared/contracts";

export class CreateCategoryCommand extends Command {
  readonly data: CategoryInput | undefined;

  constructor(input?: { data?: CategoryInput }) {
    super();
    this.data = input?.data;
  }
}

export class CreateCategoryHandler implements Handler<CreateCategoryCommand, Row, UseCaseContext> {
  private readonly unitOfWork: UnitOfWork;
  private readonly cache: Cache;
  private readonly ids: IdGenerator;

  constructor({ unitOfWork, cache, ids }: { unitOfWork: UnitOfWork; cache: Cache; ids: IdGenerator }) {
    this.unitOfWork = unitOfWork;
    this.cache = cache;
    this.ids = ids;
  }

  async handle({ data }: CreateCategoryCommand, context: UseCaseContext = {}): Promise<Row> {
    // Kategori kataloğu sistem genelindedir: mağaza rolü yönetemez.
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
