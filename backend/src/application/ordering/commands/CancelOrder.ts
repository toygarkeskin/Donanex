"use strict";

import { Command, type Handler } from "../../shared/cqrs/Message";
import { NotFoundError, ConflictError } from "../../../domain/shared/errors";
import { requireUuid } from "../../../domain/shared/guards";
import { PackageStatus, canCustomerCancel } from "../../../domain/ordering/OrderStatus";
import { EventTypes, domainEvent } from "../../../domain/shared/DomainEvent";
import { changePackageStatus } from "../services/releaseStock";
import type { UseCaseContext } from "../../shared/authorize";
import type { Cache, UnitOfWork } from "../../shared/contracts";

export class CancelOrderCommand extends Command {
  readonly orderId: string;
  readonly userId: string;

  constructor(input?: { orderId?: string; userId?: string }) {
    super();
    this.orderId = input?.orderId as string;
    this.userId = input?.userId as string;
  }
}

export interface CancelResult {
  readonly orderId: string;
  readonly cancelledPackages: number;
}

/**
 * Müşterinin kendi siparişini iptali. Yalnızca hazırlığa alınmamış paketler
 * iptal edilebilir; kargoya verilmiş paket için destek gerekir.
 *
 * Başkasının siparişi ile hiç olmayan sipariş AYNI yanıtı alır: sipariş
 * numarası deneyerek başkasının siparişinin varlığı öğrenilemez.
 */
export class CancelOrderHandler implements Handler<CancelOrderCommand, CancelResult, UseCaseContext> {
  private readonly unitOfWork: UnitOfWork;
  private readonly cache: Cache;

  constructor({ unitOfWork, cache }: { unitOfWork: UnitOfWork; cache: Cache }) {
    this.unitOfWork = unitOfWork;
    this.cache = cache;
  }

  async handle({ orderId, userId }: CancelOrderCommand, context: UseCaseContext = {}): Promise<CancelResult> {
    requireUuid(orderId, "Sipariş numarası");

    const result = await this.unitOfWork.run(async (repos) => {
      // Sahiplik sorgunun parçası: "senin değil" ile "yok" aynı yanıtı verir.
      const order = await repos.orders.lockForUser(orderId, userId);
      if (!order) throw new NotFoundError("Sipariş bulunamadı.");

      const packages = await repos.orders.listPackages(order.id);
      const cancellable = packages.filter((pkg) => canCustomerCancel(pkg.status));
      if (!cancellable.length) {
        throw new ConflictError("Bu sipariş artık iptal edilemez. Lütfen destek ekibiyle iletişime geçin.");
      }

      for (const pkg of cancellable) {
        await changePackageStatus(repos, { order, pkg, status: PackageStatus.CANCELLED });
      }

      await repos.outbox.add(
        domainEvent(EventTypes.ORDER_CANCELLED, "order", order.id, {
          orderNumber: order.orderNumber,
          userId: order.userId,
          email: order.contactEmail,
          fullName: order.contactFullName,
          cancelledPackages: cancellable.length,
          // İptal edilen paketlerin mağazaları: hazırlamaya başlamasınlar diye
          // bildirim onların kutusuna da düşüyor.
          packages: cancellable.map((pkg) => ({ storeId: pkg.storeId, packageId: pkg.id }))
        })
      );
      await repos.audit.record({
        actorId: userId,
        action: "order.cancelled_by_customer",
        resourceType: "order",
        resourceId: order.id,
        context
      });

      return { orderId: order.id, cancelledPackages: cancellable.length };
    });

    await this.cache.deleteByPrefix("catalog:");
    return result;
  }
}
