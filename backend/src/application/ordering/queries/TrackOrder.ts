"use strict";

import { Query, type Handler } from "../../shared/cqrs/Message";
import { NotFoundError, ValidationError } from "../../../domain/shared/errors";
import type { OpaqueTokens, OrderReadModel, Row } from "../../shared/contracts";

export class TrackOrderQuery extends Query {
  readonly orderNumber: unknown;
  readonly trackingCode: unknown;

  constructor(input?: { orderNumber?: unknown; trackingCode?: unknown }) {
    super();
    this.orderNumber = input?.orderNumber;
    this.trackingCode = input?.trackingCode;
  }
}

/**
 * Kayıtsız müşterinin sipariş takibi: sipariş numarası + takip kodu.
 * Kod bilinmeden hiçbir bilgi dönmez; yanıt kişisel veri içermez.
 */
export class TrackOrderHandler implements Handler<TrackOrderQuery, Row> {
  private readonly readModel: OrderReadModel;
  private readonly opaqueTokens: OpaqueTokens;

  constructor({ orderReadModel, opaqueTokens }: { orderReadModel: OrderReadModel; opaqueTokens: OpaqueTokens }) {
    this.readModel = orderReadModel;
    this.opaqueTokens = opaqueTokens;
  }

  async handle({ orderNumber, trackingCode }: TrackOrderQuery): Promise<Row> {
    if (typeof orderNumber !== "string" || !/^[A-Z0-9-]{6,30}$/.test(orderNumber.trim())) {
      throw new ValidationError("Sipariş numarası geçersiz.");
    }
    if (!this.opaqueTokens.isWellFormed(trackingCode)) {
      throw new ValidationError("Takip kodu geçersiz.");
    }

    const order = await this.readModel.getByTrackingCode(
      orderNumber.trim().toUpperCase(),
      this.opaqueTokens.hash(trackingCode as string)
    );
    if (!order) throw new NotFoundError("Sipariş bulunamadı veya takip kodu yanlış.");
    return order;
  }
}
