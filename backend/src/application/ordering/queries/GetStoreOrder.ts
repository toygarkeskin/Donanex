"use strict";

import { Query, type Handler } from "../../shared/cqrs/Message";
import { NotFoundError } from "../../../domain/shared/errors";
import { requireUuid } from "../../../domain/shared/guards";
import { orderReference } from "../../../domain/ordering/orderReference";
import { assertCan, type UseCaseContext } from "../../shared/authorize";
import type { OrderReadModel, Row } from "../../shared/contracts";

export class GetStoreOrderQuery extends Query {
  readonly storeId: string;
  readonly packageId: string;

  constructor(input?: { storeId?: string; packageId?: string }) {
    super();
    this.storeId = input?.storeId as string;
    this.packageId = input?.packageId as string;
  }
}

export class GetStoreOrderHandler implements Handler<GetStoreOrderQuery, Row, UseCaseContext> {
  private readonly readModel: OrderReadModel;

  constructor({ orderReadModel }: { orderReadModel: OrderReadModel }) {
    this.readModel = orderReadModel;
  }

  /**
   * packageId hem paket kimliği (UUID) hem sipariş numarası olabilir.
   *
   * Sipariş numarası mağaza ile birlikte tek bir paketi gösteriyor, çünkü
   * bir siparişin bir mağazada yalnızca BİR paketi olabilir (şemada
   * UNIQUE (order_id, store_id)). Mağaza numarası yine zorunlu ve yetki
   * onun kapsamında soruluyor: numara tahmin edilse bile başka mağazanın
   * paketine ulaşılamıyor.
   */
  async handle({ storeId, packageId }: GetStoreOrderQuery, context: UseCaseContext = {}): Promise<Row> {
    requireUuid(storeId, "Mağaza numarası");
    const ref = orderReference(packageId, "Paket numarası");
    assertCan(context, "order:read", { storeId });

    const pkg = await this.readModel.getForStore(ref, storeId);
    if (!pkg) throw new NotFoundError("Paket bulunamadı.");
    return pkg;
  }
}
