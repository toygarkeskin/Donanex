"use strict";

const { OrderStatus } = require("../../../../domain/ordering/OrderStatus");
const { applyStatusChange } = require("../../services/applyStatusChange");

const BATCH_SIZE = 100;

/**
 * Ödenmeyen siparişler stoğu sonsuza dek tutmasın: süresi dolanlar iptal edilir, stok iade edilir.
 * Zamanlayıcı (main.js) tarafından periyodik çalıştırılır.
 */
class ExpireUnpaidOrdersHandler {
  constructor({ unitOfWork }) {
    this.unitOfWork = unitOfWork;
  }

  async handle({ olderThanMinutes }) {
    const cutoff = new Date(Date.now() - olderThanMinutes * 60_000);

    return this.unitOfWork.run(async (repos) => {
      const orders = await repos.orders.lockUnpaidOlderThan(cutoff, BATCH_SIZE);
      for (const order of orders) {
        await applyStatusChange(repos, order, OrderStatus.CANCELLED);
      }
      return { expired: orders.length };
    });
  }
}

module.exports = { ExpireUnpaidOrdersHandler };
