"use strict";

import { Command, type Handler } from "../../shared/cqrs/Message";
import { ValidationError, NotFoundError, ConflictError } from "../../../domain/shared/errors";
import { OrderStatus, PackageStatus, type OrderStatusKind } from "../../../domain/ordering/OrderStatus";
import { EventTypes, domainEvent } from "../../../domain/shared/DomainEvent";
import { changePackageStatus } from "../services/releaseStock";
import type { UseCaseContext } from "../../shared/authorize";
import type { Cache, Clock, IdGenerator, OpaqueTokens, UnitOfWork } from "../../shared/contracts";

export type PaymentOutcome = "success" | "failure";

export class ProcessPaymentCommand extends Command {
  readonly orderId: string;
  readonly trackingCode: string | null;
  readonly userId: string | null;
  readonly outcome: unknown;

  constructor(input?: { orderId?: string; trackingCode?: string | null; userId?: string | null; outcome?: unknown }) {
    super();
    this.orderId = input?.orderId as string;
    this.trackingCode = input?.trackingCode ?? null;
    this.userId = input?.userId ?? null;
    this.outcome = input?.outcome;
  }
}

export interface PaymentResult {
  readonly orderId: string;
  readonly orderNumber: string;
  readonly status: OrderStatusKind;
  readonly simulated: true;
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
export class ProcessPaymentHandler implements Handler<ProcessPaymentCommand, PaymentResult, UseCaseContext> {
  private readonly cache: Cache;
  private readonly unitOfWork: UnitOfWork;
  private readonly opaqueTokens: OpaqueTokens;
  private readonly ids: IdGenerator;
  private readonly clock: Clock;
  private readonly paymentsMode: string;

  constructor({
    unitOfWork,
    opaqueTokens,
    ids,
    clock,
    paymentsMode,
    cache
  }: {
    unitOfWork: UnitOfWork;
    opaqueTokens: OpaqueTokens;
    ids: IdGenerator;
    clock: Clock;
    paymentsMode: string;
    cache: Cache;
  }) {
    this.cache = cache;
    this.unitOfWork = unitOfWork;
    this.opaqueTokens = opaqueTokens;
    this.ids = ids;
    this.clock = clock;
    this.paymentsMode = paymentsMode;
  }

  async handle(
    { orderId, trackingCode, userId, outcome }: ProcessPaymentCommand,
    context: UseCaseContext = {}
  ): Promise<PaymentResult> {
    if (this.paymentsMode !== "simulated") {
      throw new ConflictError("Ödeme benzetimi bu ortamda kapalı.");
    }
    if (outcome !== "success" && outcome !== "failure") {
      throw new ValidationError('Ödeme sonucu "success" veya "failure" olmalı.');
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
        /*
         * Mağazalar "yeni sipariş" bildirimini BURADA alıyor, sipariş
         * verildiğinde değil: ödemesi gelmeyen sipariş kendiliğinden iptal
         * oluyor, o yüzden mağazaya ancak hazırlanabilir hâle gelince haber
         * veriliyor. Olay kendi kendine yeterli olmalı, bu yüzden paket
         * listesi içine konuyor — tüketici veritabanına geri dönmez.
         */
        const paketler = await repos.orders.listPackages(order.id);
        await repos.outbox.add(
          domainEvent(EventTypes.ORDER_PAID, "order", order.id, {
            orderNumber: order.orderNumber,
            userId: order.userId,
            email: order.contactEmail,
            fullName: order.contactFullName,
            total: order.total,
            packages: paketler.map((pkg) => ({ storeId: pkg.storeId, packageId: pkg.id }))
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
            userId: order.userId,
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
        simulated: true as const
      };
    });

    // Başarısız ödeme stoğu iade eder; vitrin bunu hemen görmeli.
    await this.cache.deleteByPrefix("catalog:");
    return result;
  }
}
