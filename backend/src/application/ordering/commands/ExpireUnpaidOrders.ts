"use strict";

import { Command, type Handler } from "../../shared/cqrs/Message";
import { OrderStatus, PackageStatus } from "../../../domain/ordering/OrderStatus";
import { changePackageStatus } from "../services/releaseStock";
import type { Cache, Clock, UnitOfWork } from "../../shared/contracts";

const BATCH_SIZE = 100;

export class ExpireUnpaidOrdersCommand extends Command {
  readonly olderThanMinutes: number;

  constructor(input?: { olderThanMinutes?: number }) {
    super();
    this.olderThanMinutes = input?.olderThanMinutes as number;
  }
}

export interface ExpiryResult {
  readonly expired: number;
}

/**
 * Ödenmeyen siparişler stoğu sonsuza dek tutmasın: süresi dolanlar iptal edilir
 * ve stok iade edilir. Zamanlanmış iş olarak worker sürecinde çalışır.
 *
 * Kayıtlar SKIP LOCKED ile kilitlenir; birden çok worker aynı anda çalışsa bile
 * aynı sipariş iki kez işlenmez.
 */
export class ExpireUnpaidOrdersHandler implements Handler<ExpireUnpaidOrdersCommand, ExpiryResult> {
  private readonly unitOfWork: UnitOfWork;
  private readonly clock: Clock;
  private readonly cache: Cache;

  constructor({ unitOfWork, clock, cache }: { unitOfWork: UnitOfWork; clock: Clock; cache: Cache }) {
    this.unitOfWork = unitOfWork;
    this.clock = clock;
    this.cache = cache;
  }

  async handle({ olderThanMinutes }: ExpireUnpaidOrdersCommand): Promise<ExpiryResult> {
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
