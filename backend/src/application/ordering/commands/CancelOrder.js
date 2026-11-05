"use strict";

const { Command } = require("../../shared/cqrs/Message");
const { NotFoundError, ConflictError } = require("../../../domain/shared/errors");
const { requireUuid } = require("../../../domain/shared/guards");
const { PackageStatus, canCustomerCancel } = require("../../../domain/ordering/OrderStatus");
const { EventTypes, domainEvent } = require("../../../domain/shared/DomainEvent");
const { changePackageStatus } = require("../services/releaseStock");

class CancelOrderCommand extends Command {
  constructor(input) {
    super();
    this.orderId = input?.orderId;
    this.userId = input?.userId;
  }
}

/**
 * Müşterinin kendi siparişini iptali. Yalnızca hazırlığa alınmamış paketler
 * iptal edilebilir; kargoya verilmiş paket için destek gerekir.
 *
 * Başkasının siparişi ile hiç olmayan sipariş AYNI yanıtı alır: sipariş
 * numarası deneyerek başkasının siparişinin varlığı öğrenilemez.
 */
class CancelOrderHandler {
  constructor({ unitOfWork, cache }) {
    this.unitOfWork = unitOfWork;
    this.cache = cache;
  }

  async handle({ orderId, userId }, context = {}) {
    requireUuid(orderId, "Sipariş numarası");

    const result = await this.unitOfWork.run(async (repos) => {
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
          email: order.contactEmail,
          fullName: order.contactFullName,
          cancelledPackages: cancellable.length
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

module.exports = { CancelOrderCommand, CancelOrderHandler };
