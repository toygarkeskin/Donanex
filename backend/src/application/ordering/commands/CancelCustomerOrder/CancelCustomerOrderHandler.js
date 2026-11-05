"use strict";

const { ValidationError, NotFoundError, ConflictError } = require("../../../../domain/shared/errors");
const { isId } = require("../../../../domain/shared/guards");
const { OrderStatus, canCustomerCancel } = require("../../../../domain/ordering/OrderStatus");
const { applyStatusChange } = require("../../services/applyStatusChange");

/** Müşteri yalnızca KENDİ siparişini ve hazırlanmaya başlamadan iptal edebilir. */
class CancelCustomerOrderHandler {
  constructor({ unitOfWork }) {
    this.unitOfWork = unitOfWork;
  }

  async handle({ customerId, orderId }) {
    if (!isId(orderId)) throw new ValidationError("Geçersiz sipariş numarası.");

    return this.unitOfWork.run(async (repos) => {
      const order = await repos.orders.lockById(Number(orderId));
      // Başkasının siparişi ile olmayan sipariş aynı yanıtı alır (numara taraması engellenir).
      if (!order || String(order.customerId) !== String(customerId)) {
        throw new NotFoundError("Sipariş bulunamadı.");
      }
      if (!canCustomerCancel(order.status)) {
        throw new ConflictError("Bu sipariş artık iptal edilemez. Lütfen destek ekibiyle iletişime geç.");
      }
      return applyStatusChange(repos, order, OrderStatus.CANCELLED);
    });
  }
}

module.exports = { CancelCustomerOrderHandler };
