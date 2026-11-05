"use strict";

const { ValidationError, NotFoundError, ConflictError } = require("../../../../domain/shared/errors");
const { isId } = require("../../../../domain/shared/guards");
const { OrderStatus } = require("../../../../domain/ordering/OrderStatus");
const { applyStatusChange } = require("../../services/applyStatusChange");

/**
 * TEST ödeme sonucu. Gerçek ödeme almaz. Başarısız sonuçta stok iade edilir.
 * Yalnızca takip kodunu bilen kişi (siparişin sahibi) sonucu kaydedebilir.
 */
class RecordTestPaymentHandler {
  constructor({ unitOfWork, opaqueTokens }) {
    this.unitOfWork = unitOfWork;
    this.opaqueTokens = opaqueTokens;
  }

  async handle({ orderId, trackingCode, successful }) {
    if (!isId(orderId) || typeof successful !== "boolean") {
      throw new ValidationError("Geçersiz test isteği.");
    }
    if (!this.opaqueTokens.isWellFormed(trackingCode)) {
      throw new NotFoundError("Sipariş bulunamadı veya takip kodu yanlış.");
    }

    const status = successful ? OrderStatus.TEST_SUCCEEDED : OrderStatus.TEST_FAILED;
    const hash = this.opaqueTokens.hash(trackingCode);

    return this.unitOfWork.run(async (repos) => {
      const order = await repos.orders.lockByIdAndTrackingHash(Number(orderId), hash);
      if (!order) throw new NotFoundError("Sipariş bulunamadı veya takip kodu yanlış.");
      if (order.status !== OrderStatus.AWAITING_PAYMENT) {
        throw new ConflictError("Bu sipariş daha önce işlenmiş.");
      }
      return applyStatusChange(repos, order, status);
    });
  }
}

module.exports = { RecordTestPaymentHandler };
