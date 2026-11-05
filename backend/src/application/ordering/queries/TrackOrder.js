"use strict";

const { Query } = require("../../shared/cqrs/Message");
const { NotFoundError, ValidationError } = require("../../../domain/shared/errors");

class TrackOrderQuery extends Query {
  constructor(input) {
    super();
    this.orderNumber = input?.orderNumber;
    this.trackingCode = input?.trackingCode;
  }
}

/**
 * Kayıtsız müşterinin sipariş takibi: sipariş numarası + takip kodu.
 * Kod bilinmeden hiçbir bilgi dönmez; yanıt kişisel veri içermez.
 */
class TrackOrderHandler {
  constructor({ orderReadModel, opaqueTokens }) {
    this.readModel = orderReadModel;
    this.opaqueTokens = opaqueTokens;
  }

  async handle({ orderNumber, trackingCode }) {
    if (typeof orderNumber !== "string" || !/^[A-Z0-9-]{6,30}$/.test(orderNumber.trim())) {
      throw new ValidationError("Sipariş numarası geçersiz.");
    }
    if (!this.opaqueTokens.isWellFormed(trackingCode)) {
      throw new ValidationError("Takip kodu geçersiz.");
    }

    const order = await this.readModel.getByTrackingCode(
      orderNumber.trim().toUpperCase(),
      this.opaqueTokens.hash(trackingCode)
    );
    if (!order) throw new NotFoundError("Sipariş bulunamadı veya takip kodu yanlış.");
    return order;
  }
}

module.exports = { TrackOrderQuery, TrackOrderHandler };
