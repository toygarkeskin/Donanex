"use strict";

import { Query, type Handler } from "../../shared/cqrs/Message";
import { NotFoundError } from "../../../domain/shared/errors";
import { orderReference } from "../../../domain/ordering/orderReference";
import type { OrderReadModel, Row } from "../../shared/contracts";

export class GetMyOrderQuery extends Query {
  readonly userId: string;
  readonly orderId: string;

  constructor(input?: { userId?: string; orderId?: string }) {
    super();
    this.userId = input?.userId as string;
    this.orderId = input?.orderId as string;
  }
}

export class GetMyOrderHandler implements Handler<GetMyOrderQuery, Row> {
  private readonly readModel: OrderReadModel;

  constructor({ orderReadModel }: { orderReadModel: OrderReadModel }) {
    this.readModel = orderReadModel;
  }

  /**
   * orderId hem iç kimlik (UUID) hem sipariş numarası olabilir.
   *
   * Adres çubuğunda okunur olan numaradır; UUID ise eski bağlantılarda,
   * e-postalarda ve bildirimlerde duruyor. İkisi de kabul edilmezse ya
   * okunur adresten vazgeçmek ya da gönderilmiş bağlantıları kırmak
   * gerekirdi.
   */
  async handle({ userId, orderId }: GetMyOrderQuery): Promise<Row> {
    const ref = orderReference(orderId);
    // Kullanıcı kimliği sorgunun parçası: başkasının siparişi görülemez.
    const order = await this.readModel.getForUser(ref, userId);
    if (!order) throw new NotFoundError("Sipariş bulunamadı.");
    return order;
  }
}
