"use strict";

const { Command } = require("../../shared/cqrs/Message");
const { ValidationError, NotFoundError, ConflictError } = require("../../../domain/shared/errors");
const { OrderStatus, PackageStatus } = require("../../../domain/ordering/OrderStatus");
const { EventTypes, domainEvent } = require("../../../domain/shared/DomainEvent");
const { changePackageStatus } = require("../services/releaseStock");

class ProcessPaymentCommand extends Command {
  constructor(input) {
    super();
    this.orderId = input?.orderId;
    this.trackingCode = input?.trackingCode ?? null;
    this.userId = input?.userId ?? null;
    this.outcome = input?.outcome;
  }
}

/**
 * Ödeme sonucunu işler.
 *
 * DEMO ORTAMI: gerçek bir ödeme sağlayıcısı bağlı değildir; sonuç
 * (başarılı/başarısız) çağıranın seçimidir ve hiçbir para hareketi olmaz.
 * Bu uç yalnızca PAYMENTS_MODE=simulated iken açıktır.
 *
 * Siparişe erişim, siparişin sahibi olmakla (giriş yapmış kullanıcı) ya da
 * takip kodunu bilmekle kanıtlanır; sipariş numarasını tahmin etmek yetmez.
 */
class ProcessPaymentHandler {
  constructor({ unitOfWork, opaqueTokens, ids, clock, paymentsMode, cache }) {
    this.cache = cache;
    this.unitOfWork = unitOfWork;
    this.opaqueTokens = opaqueTokens;
    this.ids = ids;
    this.clock = clock;
    this.paymentsMode = paymentsMode;
  }

  async handle({ orderId, trackingCode, userId, outcome }, context = {}) {
    if (this.paymentsMode !== "simulated") {
      throw new ConflictError("Ödeme benzetimi bu ortamda kapalı.");
    }
    if (outcome !== "success" && outcome !== "failure") {
      throw new ValidationError("Ödeme sonucu \"success\" veya \"failure\" olmalı.");
    }

    const result = await this.unitOfWork.run(async (repos) => {
      const order = await repos.orders.lockForPayment({
        orderId,
        userId,
        trackingCodeHash: trackingCode ? this.opaqueTokens.hash(trackingCode) : null
      });
      if (!order) throw new NotFoundError("Sipariş bulunamadı.");
      if (order.status !== OrderStatus.PENDING_PAYMENT) {
        throw new ConflictError("Bu siparişin ödemesi daha önce işlenmiş.");
      }

      const succeeded = outcome === "success";
      await repos.orders.recordPayment({
        id: this.ids.uuid(),
        orderId: order.id,
        provider: "simulated",
        status: succeeded ? "succeeded" : "failed",
        amountCents: order.totalCents,
        reference: `SIM-${this.ids.uuid().slice(0, 8).toUpperCase()}`,
        createdAt: this.clock.now()
      });

      if (succeeded) {
        await repos.orders.setStatus(order.id, OrderStatus.PAID);
        await repos.outbox.add(
          domainEvent(EventTypes.ORDER_PAID, "order", order.id, {
            orderNumber: order.orderNumber,
            email: order.contactEmail,
            fullName: order.contactFullName,
            total: order.total
          })
        );
      } else {
        // Başarısız ödeme: ayrılan stok paket paket geri verilir.
        const packages = await repos.orders.listPackages(order.id);
        for (const pkg of packages) {
          await changePackageStatus(repos, { order, pkg, status: PackageStatus.CANCELLED });
        }
        await repos.orders.setStatus(order.id, OrderStatus.PAYMENT_FAILED);
        await repos.outbox.add(
          domainEvent(EventTypes.ORDER_PAYMENT_FAILED, "order", order.id, {
            orderNumber: order.orderNumber,
            email: order.contactEmail,
            fullName: order.contactFullName
          })
        );
      }

      await repos.audit.record({
        actorId: userId,
        action: succeeded ? "order.paid" : "order.payment_failed",
        resourceType: "order",
        resourceId: order.id,
        context
      });

      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: succeeded ? OrderStatus.PAID : OrderStatus.PAYMENT_FAILED,
        simulated: true
      };
    });

    // Başarısız ödeme stoğu iade eder; vitrin bunu hemen görmeli.
    await this.cache.deleteByPrefix("catalog:");
    return result;
  }
}

module.exports = { ProcessPaymentCommand, ProcessPaymentHandler };
