"use strict";

import { Query, type Handler } from "../../shared/cqrs/Message";
import { NotFoundError } from "../../../domain/shared/errors";
import type { Row, StoreReadModel } from "../../shared/contracts";

export class GetStoreQuery extends Query {
  readonly slug: string;

  constructor(input?: { slug?: string }) {
    super();
    this.slug = input?.slug as string;
  }
}

export class GetStoreHandler implements Handler<GetStoreQuery, Row> {
  private readonly readModel: StoreReadModel;

  constructor({ storeReadModel }: { storeReadModel: StoreReadModel }) {
    this.readModel = storeReadModel;
  }

  async handle({ slug }: GetStoreQuery): Promise<Row> {
    const store = await this.readModel.getBySlug(slug);
    if (!store) throw new NotFoundError("Mağaza bulunamadı.");
    return store;
  }
}
