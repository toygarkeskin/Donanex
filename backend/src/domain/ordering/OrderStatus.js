"use strict";

const { ConflictError } = require("../shared/errors");

const OrderStatus = Object.freeze({
  AWAITING_PAYMENT: "Ödeme bekleniyor",
  TEST_SUCCEEDED: "Test başarılı",
  TEST_FAILED: "Test başarısız",
  PREPARING: "Hazırlanıyor",
  SHIPPED: "Kargoya verildi",
  DELIVERED: "Teslim edildi",
  COMPLETED: "Tamamlandı",
  CANCELLED: "İptal edildi"
});

const ALL_STATUSES = Object.freeze(Object.values(OrderStatus));

/** Sipariş yaşam döngüsü: her durumdan yalnızca buradaki durumlara geçilebilir. */
const TRANSITIONS = Object.freeze({
  [OrderStatus.AWAITING_PAYMENT]: [
    OrderStatus.TEST_SUCCEEDED,
    OrderStatus.TEST_FAILED,
    OrderStatus.PREPARING,
    OrderStatus.CANCELLED
  ],
  [OrderStatus.TEST_SUCCEEDED]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
  [OrderStatus.TEST_FAILED]: [],
  [OrderStatus.PREPARING]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]: [OrderStatus.COMPLETED],
  [OrderStatus.COMPLETED]: [],
  [OrderStatus.CANCELLED]: []
});

/** Bu durumlara geçen siparişin ayırdığı stok ürünlere geri verilir. */
const STOCK_RELEASING_STATUSES = Object.freeze([OrderStatus.TEST_FAILED, OrderStatus.CANCELLED]);

/** Müşterinin kendi başına iptal edebileceği durumlar (henüz hazırlanmamış). */
const CUSTOMER_CANCELLABLE = Object.freeze([OrderStatus.AWAITING_PAYMENT, OrderStatus.TEST_SUCCEEDED]);

const isValidStatus = (status) => ALL_STATUSES.includes(status);
const releasesStock = (status) => STOCK_RELEASING_STATUSES.includes(status);
const nextStatuses = (status) => TRANSITIONS[status] || [];
const canCustomerCancel = (status) => CUSTOMER_CANCELLABLE.includes(status);

function assertTransition(from, to) {
  if (!nextStatuses(from).includes(to)) {
    throw new ConflictError(`Sipariş "${from}" durumundan "${to}" durumuna alınamaz.`);
  }
}

module.exports = {
  OrderStatus,
  ALL_STATUSES,
  isValidStatus,
  releasesStock,
  nextStatuses,
  canCustomerCancel,
  assertTransition
};
