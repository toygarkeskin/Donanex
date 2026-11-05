"use strict";

const { Command } = require("../../shared/cqrs/Message");
const { OrderStatus, PackageStatus } = require("../../../domain/ordering/OrderStatus");
const { changePackageStatus } = require("../services/releaseStock");

const BATCH_SIZE = 100;

class ExpireUnpaidOrdersCommand extends Command {
  constructor(input) {
    super();
    this.olderThanMinutes = input?.olderThanMinutes;
  }
}

/**
 * Ödenmeyen siparişler stoğu sonsuza dek tutmasın: süresi dolanlar iptal edilir
 * ve stok iade edilir. Zamanlanmış iş olarak worker sürecinde çalışır.
 *
 * Kayıtlar SKIP LOCKED ile kilitlenir; birden çok worker aynı anda çalışsa bile
 * aynı sipariş iki kez işlenmez.
 */
class ExpireUnpaidOrdersHandler {
  constructor({ unitOfWork, clock, cache }) {
    this.unitOfWork = unitOfWork;
    this.clock = clock;
    this.cache = cache;
  }

  async handle({ olderThanMinutes }) {
    const cutoff = new Date(this.clock.now().getTime() - olderThanMinutes * 60_000);

    const result = await this.unitOfWork.run(async (repos) => {
      const orders = await repos.orders.lockUnpaidOlderThan(cutoff, BATCH_SIZE);

      for (const order of orders) {
        const packages = await repos.orders.listPackages(order.id);
        for (const pkg of packages) {
          await changePackageStatus(repos, { order, pkg, status: PackageStatus.CANCELLED });
        }
        await repos.orders.setStatus(order.id, OrderStatus.CANCELLED);
      }
      return { expired: orders.length };
    });

    if (result.expired > 0) await this.cache.deleteByPrefix("catalog:");
    return result;
  }
}

module.exports = { ExpireUnpaidOrdersCommand, ExpireUnpaidOrdersHandler };
