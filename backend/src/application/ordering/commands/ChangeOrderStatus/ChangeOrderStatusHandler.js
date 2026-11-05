"use strict";

const { ValidationError, NotFoundError } = require("../../../../domain/shared/errors");
const { isId } = require("../../../../domain/shared/guards");
const { isValidStatus } = require("../../../../domain/ordering/OrderStatus");
const { applyStatusChange } = require("../../services/applyStatusChange");

class ChangeOrderStatusHandler {
  constructor({ unitOfWork }) {
    this.unitOfWork = unitOfWork;
  }

  async handle({ orderId, status }) {
    if (!isId(orderId)) throw new ValidationError("Geçersiz sipariş numarası.");
    if (!isValidStatus(status)) throw new ValidationError("Geçersiz sipariş durumu.");

    return this.unitOfWork.run(async (repos) => {
      const order = await repos.orders.lockById(Number(orderId));
      if (!order) throw new NotFoundError("Sipariş bulunamadı.");
      return applyStatusChange(repos, order, status);
    });
  }
}

module.exports = { ChangeOrderStatusHandler };
