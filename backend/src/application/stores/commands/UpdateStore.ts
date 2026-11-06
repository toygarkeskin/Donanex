"use strict";

import { Command, type Handler } from "../../shared/cqrs/Message";
import { NotFoundError } from "../../../domain/shared/errors";
import { requireUuid } from "../../../domain/shared/guards";
import { validateStoreUpdate, type StoreApplicationInput } from "../../../domain/stores/Store";
import { assertCan, type UseCaseContext } from "../../shared/authorize";
import type { Cache, Row, UnitOfWork } from "../../shared/contracts";

export class UpdateStoreCommand extends Command {
  readonly storeId: string;
  readonly data: StoreApplicationInput | undefined;

  constructor(input?: { storeId?: string; data?: StoreApplicationInput }) {
    super();
    this.storeId = input?.storeId as string;
    this.data = input?.data;
  }
}

export class UpdateStoreHandler implements Handler<UpdateStoreCommand, Row, UseCaseContext> {
  private readonly unitOfWork: UnitOfWork;
  private readonly cache: Cache;

  constructor({ unitOfWork, cache }: { unitOfWork: UnitOfWork; cache: Cache }) {
    this.unitOfWork = unitOfWork;
    this.cache = cache;
  }

  async handle({ storeId, data }: UpdateStoreCommand, context: UseCaseContext = {}): Promise<Row> {
    requireUuid(storeId, "Mağaza numarası");
    assertCan(context, "store:write", { storeId });
    const update = validateStoreUpdate(data);

    const store = await this.unitOfWork.run(async (repos) => {
      const updated = await repos.stores.update(storeId, update);
      if (!updated) throw new NotFoundError("Mağaza bulunamadı.");
      await repos.audit.record({
        actorId: context.actorId ?? null,
        action: "store.updated",
        resourceType: "store",
        resourceId: storeId,
        context
      });
      return updated;
    });

    await this.cache.deleteByPrefix("catalog:");
    return store;
  }
}
