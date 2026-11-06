"use strict";

import { Command, type Handler } from "../../shared/cqrs/Message";
import { ConflictError } from "../../../domain/shared/errors";
import { createStoreApplication, type StoreApplicationInput } from "../../../domain/stores/Store";
import { EventTypes, domainEvent } from "../../../domain/shared/DomainEvent";
import type { UseCaseContext } from "../../shared/authorize";
import type { IdGenerator, Row, UnitOfWork } from "../../shared/contracts";

export class ApplyForStoreCommand extends Command {
  readonly userId: string;
  readonly data: StoreApplicationInput | undefined;

  constructor(input?: { userId?: string; data?: StoreApplicationInput }) {
    super();
    this.userId = input?.userId as string;
    this.data = input?.data;
  }
}

/**
 * Mağaza başvurusu. Herhangi bir kayıtlı kullanıcı başvurabilir; mağaza
 * yönetici onaylayana kadar "pending" durumundadır ve vitrinde görünmez.
 * Mağaza sahibi rolü de ancak onayla birlikte verilir.
 */
export class ApplyForStoreHandler implements Handler<ApplyForStoreCommand, Row, UseCaseContext> {
  private readonly unitOfWork: UnitOfWork;
  private readonly ids: IdGenerator;

  constructor({ unitOfWork, ids }: { unitOfWork: UnitOfWork; ids: IdGenerator }) {
    this.unitOfWork = unitOfWork;
    this.ids = ids;
  }

  async handle({ userId, data }: ApplyForStoreCommand, context: UseCaseContext = {}): Promise<Row> {
    const application = createStoreApplication(data);

    return this.unitOfWork.run(async (repos) => {
      if (await repos.stores.slugExists(application.slug)) {
        throw new ConflictError("Bu mağaza adı kullanılıyor, başka bir ad deneyin.");
      }
      if (await repos.stores.hasPendingApplication(userId)) {
        throw new ConflictError("Zaten onay bekleyen bir mağaza başvurunuz var.");
      }

      const store = await repos.stores.create({ id: this.ids.uuid(), ownerUserId: userId, ...application });

      await repos.outbox.add(
        domainEvent(EventTypes.STORE_APPLIED, "store", store.id, { name: store.name, ownerUserId: userId })
      );
      await repos.audit.record({
        actorId: userId,
        action: "store.applied",
        resourceType: "store",
        resourceId: store.id,
        context
      });
      return store;
    });
  }
}
