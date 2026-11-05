"use strict";

const { ValidationError, NotFoundError } = require("../../../../domain/shared/errors");
const { isId } = require("../../../../domain/shared/guards");

/** Müşterinin sipariş takibi: sipariş numarası + takip kodu. */
class TrackOrderHandler {
  constructor({ orderReadModel, opaqueTokens }) {
    this.readModel = orderReadModel;
    this.opaqueTokens = opaqueTokens;
  }

  async handle({ orderId, trackingCode }) {
    if (!isId(orderId) || !this.opaqueTokens.isWellFormed(trackingCode)) {
      throw new ValidationError("Sipariş numarası veya takip kodu geçersiz.");
    }
    const order = await this.readModel.findForTracking(Number(orderId), this.opaqueTokens.hash(trackingCode));
    if (!order) throw new NotFoundError("Sipariş bulunamadı veya takip kodu yanlış.");
    return order;
  }
}

module.exports = { TrackOrderHandler };
