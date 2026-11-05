"use strict";

const { NotFoundError } = require("../../../../domain/shared/errors");
const { isId } = require("../../../../domain/shared/guards");

/** Test ödeme sayfası için kısa özet. Takip kodu olmadan hiçbir şey döndürmez. */
class GetOrderPaymentSummaryHandler {
  constructor({ orderReadModel, opaqueTokens }) {
    this.readModel = orderReadModel;
    this.opaqueTokens = opaqueTokens;
  }

  async handle({ orderId, trackingCode }) {
    const notFound = () => new NotFoundError("Sipariş bulunamadı veya takip kodu yanlış.");
    if (!isId(orderId) || !this.opaqueTokens.isWellFormed(trackingCode)) throw notFound();

    const order = await this.readModel.getPaymentSummary(Number(orderId), this.opaqueTokens.hash(trackingCode));
    if (!order) throw notFound();
    return order;
  }
}

module.exports = { GetOrderPaymentSummaryHandler };
