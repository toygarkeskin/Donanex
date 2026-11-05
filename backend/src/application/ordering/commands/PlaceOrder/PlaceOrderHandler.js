"use strict";

const { Order } = require("../../../../domain/ordering/Order");

class PlaceOrderHandler {
  constructor({ unitOfWork, opaqueTokens }) {
    this.unitOfWork = unitOfWork;
    this.opaqueTokens = opaqueTokens;
  }

  async handle({ checkout, customerId }) {
    const { recipient, items } = Order.validateCheckout(checkout);
    const trackingCode = this.opaqueTokens.generate();

    const saved = await this.unitOfWork.run(async ({ products, orders }) => {
      // Satırlar kilitlenir: aynı anda gelen iki sipariş aynı stoğu satamaz.
      const current = await products.lockActiveByIds(items.map((item) => item.productId));
      const order = Order.place({ customerId, recipient, items, products: current });

      const created = await orders.add(order, this.opaqueTokens.hash(trackingCode));
      for (const line of order.lines) {
        await products.decreaseStock(line.productId, line.quantity);
      }
      return created;
    });

    return {
      orderId: saved.id,
      total: saved.total,
      status: saved.status,
      // Takip kodu yalnızca bu yanıtta açık olarak döner; veritabanında özeti tutulur.
      trackingCode
    };
  }
}

module.exports = { PlaceOrderHandler };
