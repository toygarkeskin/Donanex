"use strict";

const { Command } = require("../../shared/cqrs/Message");
const { ValidationError } = require("../../../domain/shared/errors");
const { Order } = require("../../../domain/ordering/Order");
const { EventTypes, domainEvent } = require("../../../domain/shared/DomainEvent");
const { resolveCart } = require("../services/resolveCart");

class PlaceOrderCommand extends Command {
  constructor(input) {
    super();
    this.userId = input?.userId ?? null;
    this.guestCartId = input?.guestCartId ?? null;
    this.checkout = input?.checkout;
  }
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
class PlaceOrderHandler {
  constructor({ unitOfWork, opaqueTokens, ids, clock, cache }) {
    this.unitOfWork = unitOfWork;
    this.opaqueTokens = opaqueTokens;
    this.ids = ids;
    this.clock = clock;
    this.cache = cache;
  }

  async handle({ userId, guestCartId, checkout }, context = {}) {
    const validated = Order.validateCheckout(checkout);
    const trackingCode = this.opaqueTokens.generate();

    const result = await this.unitOfWork.run(async (repos) => {
      const cart = await resolveCart(repos, { userId, guestCartId, create: false });
      if (!cart) throw new ValidationError("Sepetiniz boş.");

      const lines = await repos.carts.listLines(cart.id);
      if (!lines.length) throw new ValidationError("Sepetiniz boş.");

      // Satırlar kilitlenir; stok kontrolü ve düşümü bu kilit altında yapılır.
      const products = await repos.products.lockForOrder(lines.map((line) => line.productId));
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
        // Takip kodu yalnızca bu yanıtta açık olarak döner.
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

module.exports = { PlaceOrderCommand, PlaceOrderHandler };
