"use strict";

const { ValidationError, NotFoundError } = require("../../../../domain/shared/errors");
const { isId } = require("../../../../domain/shared/guards");
const { createShipping } = require("../../../../domain/ordering/Shipping");

class UpdateOrderShippingHandler {
  constructor({ unitOfWork }) {
    this.unitOfWork = unitOfWork;
  }

  async handle({ orderId, data }) {
    if (!isId(orderId)) throw new ValidationError("Geçersiz sipariş numarası.");
    const shipping = createShipping(data);

    const updated = await this.unitOfWork.run(({ orders }) => orders.setShipping(Number(orderId), shipping));
    if (!updated) throw new NotFoundError("Sipariş bulunamadı.");
    return updated;
  }
}

module.exports = { UpdateOrderShippingHandler };
