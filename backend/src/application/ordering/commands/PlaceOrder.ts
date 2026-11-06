"use strict";

import { Command, type Handler } from "../../shared/cqrs/Message";
import { ValidationError } from "../../../domain/shared/errors";
import { Order, type LockedProduct } from "../../../domain/ordering/Order";
import type { CartLine } from "../../../domain/ordering/Cart";
import type { MoneyView } from "../../../domain/shared/Money";
import type { OrderStatusKind } from "../../../domain/ordering/OrderStatus";
import { EventTypes, domainEvent } from "../../../domain/shared/DomainEvent";
import { resolveCart } from "../services/resolveCart";
import type { UseCaseContext } from "../../shared/authorize";
import type { Cache, Clock, IdGenerator, OpaqueTokens, Row, UnitOfWork } from "../../shared/contracts";

export class PlaceOrderCommand extends Command {
  readonly userId: string | null;
  readonly guestCartId: string | null;
  readonly checkout: Row | undefined;

  constructor(input?: { userId?: string | null; guestCartId?: string | null; checkout?: Row }) {
    super();
    this.userId = input?.userId ?? null;
    this.guestCartId = input?.guestCartId ?? null;
    this.checkout = input?.checkout;
  }
}

export interface PlacedOrderView {
  readonly orderId: string;
  readonly orderNumber: string;
  readonly total: MoneyView;
  readonly status: OrderStatusKind;
  /** Takip kodu YALNIZCA bu yanıtta açık olarak döner; veritabanında özeti durur. */
  readonly trackingCode: string;
  readonly packages: ReadonlyArray<{ storeName: string; subtotal: MoneyView; itemCount: number }>;
}

/**
 * Siparişi oluşturur ve stoğu ayırır.
 *
 * KAYIT GEREKTİRMEZ: misafir de sipariş verebilir. Misafire, siparişini daha
 * sonra takip edebilmesi ve isterse hesabına bağlayabilmesi için tek
 * kullanımlık bir takip kodu verilir; veritabanında yalnızca kodun özeti durur.
 *
 * Tutar tamamen sunucuda hesaplanır. Ürün satırları SELECT ... FOR UPDATE ile
 * kilitlenir; aynı anda gelen iki sipariş aynı son ürünü satamaz.
 */
export class PlaceOrderHandler implements Handler<PlaceOrderCommand, PlacedOrderView, UseCaseContext> {
  private readonly unitOfWork: UnitOfWork;
  private readonly opaqueTokens: OpaqueTokens;
  private readonly ids: IdGenerator;
  private readonly clock: Clock;
  private readonly cache: Cache;

  constructor({
    unitOfWork,
    opaqueTokens,
    ids,
    clock,
    cache
  }: {
    unitOfWork: UnitOfWork;
    opaqueTokens: OpaqueTokens;
    ids: IdGenerator;
    clock: Clock;
    cache: Cache;
  }) {
    this.unitOfWork = unitOfWork;
    this.opaqueTokens = opaqueTokens;
    this.ids = ids;
    this.clock = clock;
    this.cache = cache;
  }

  async handle(
    { userId, guestCartId, checkout }: PlaceOrderCommand,
    context: UseCaseContext = {}
  ): Promise<PlacedOrderView> {
    const validated = Order.validateCheckout(checkout);
    const trackingCode = this.opaqueTokens.generate();

    const result = await this.unitOfWork.run(async (repos) => {
      const cart = await resolveCart(repos, { userId, guestCartId, create: false });
      if (!cart) throw new ValidationError("Sepetiniz boş.");

      const lines = (await repos.carts.listLines(cart.id)) as CartLine[];
      if (!lines.length) throw new ValidationError("Sepetiniz boş.");

      // Satırlar kilitlenir; stok kontrolü ve düşümü bu kilit altında yapılır.
      // Satır şekli infrastructure göçünde daralacak; şimdilik köprü dönüşüm.
      const products = (await repos.products.lockForOrder(
        lines.map((line) => line.productId)
      )) as unknown as ReadonlyMap<string, LockedProduct>;
      const draft = Order.place({ userId, checkout: validated, lines, products });

      const order = await repos.orders.create({
        id: this.ids.uuid(),
        orderNumber: await repos.orders.nextOrderNumber(),
        trackingCodeHash: this.opaqueTokens.hash(trackingCode),
        placedAt: this.clock.now(),
        ...draft
      });

      for (const pkg of draft.packages) {
        for (const item of pkg.items) {
          await repos.products.decreaseStock(item.productId, item.quantity);
        }
      }

      // Sepet siparişe dönüştü; aynı sepetten ikinci kez sipariş çıkmaz.
      await repos.carts.markConverted(cart.id, order.id);

      await repos.outbox.add(
        domainEvent(EventTypes.ORDER_PLACED, "order", order.id, {
          orderNumber: order.orderNumber,
          email: validated.contact.email,
          fullName: validated.contact.fullName,
          total: draft.total.toDecimalString(),
          trackingCode,
          isGuest: !userId,
          packages: draft.packages.map((pkg) => ({ storeId: pkg.storeId, storeName: pkg.storeName }))
        })
      );
      await repos.audit.record({
        actorId: userId,
        action: "order.placed",
        resourceType: "order",
        resourceId: order.id,
        context
      });

      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        total: draft.total.toJSON(),
        status: draft.status,
        trackingCode,
        packages: draft.packages.map((pkg) => ({
          storeName: pkg.storeName,
          subtotal: pkg.subtotal.toJSON(),
          itemCount: pkg.items.length
        }))
      };
    });

    // Stok değişti: vitrin listesi bayatlamasın.
    await this.cache.deleteByPrefix("catalog:");
    return result;
  }
}
