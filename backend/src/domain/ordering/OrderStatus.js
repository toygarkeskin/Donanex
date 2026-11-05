"use strict";

const { ConflictError } = require("../shared/errors");

/**
 * Sipariş iki seviyelidir:
 *
 *   Order   — müşterinin tek seferde verdiği sipariş ve ödemesi
 *   Package — her mağazaya düşen parça; kargoyu mağaza kendi yönetir
 *
 * Çok satıcılı yapıda bir sipariş birden çok mağazaya bölünebildiği için
 * kargo ve hazırlık durumu paket seviyesindedir.
 */
const OrderStatus = Object.freeze({
  PENDING_PAYMENT: "pending_payment",
  PAID: "paid",
  PAYMENT_FAILED: "payment_failed",
  CANCELLED: "cancelled",
  COMPLETED: "completed"
});

const PackageStatus = Object.freeze({
  // Ödeme bekleniyor ya da ödendi ama mağaza henüz hazırlığa başlamadı
  PENDING: "pending",
  PREPARING: "preparing",
  SHIPPED: "shipped",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
  REFUNDED: "refunded"
});

const ORDER_TRANSITIONS = Object.freeze({
  [OrderStatus.PENDING_PAYMENT]: [OrderStatus.PAID, OrderStatus.PAYMENT_FAILED, OrderStatus.CANCELLED],
  [OrderStatus.PAID]: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
  [OrderStatus.PAYMENT_FAILED]: [],
  [OrderStatus.CANCELLED]: [],
  [OrderStatus.COMPLETED]: []
});

const PACKAGE_TRANSITIONS = Object.freeze({
  [PackageStatus.PENDING]: [PackageStatus.PREPARING, PackageStatus.CANCELLED],
  [PackageStatus.PREPARING]: [PackageStatus.SHIPPED, PackageStatus.CANCELLED],
  [PackageStatus.SHIPPED]: [PackageStatus.DELIVERED],
  [PackageStatus.DELIVERED]: [PackageStatus.REFUNDED],
  [PackageStatus.CANCELLED]: [],
  [PackageStatus.REFUNDED]: []
});

/** Bu durumlara geçen paketin ayırdığı stok ürüne geri verilir. */
const STOCK_RELEASING = Object.freeze([PackageStatus.CANCELLED, PackageStatus.REFUNDED]);

/** Müşteri kendi siparişini yalnızca hazırlık başlamadan iptal edebilir. */
const CUSTOMER_CANCELLABLE = Object.freeze([PackageStatus.PENDING, PackageStatus.PREPARING]);

const isOrderStatus = (status) => Object.values(OrderStatus).includes(status);
const isPackageStatus = (status) => Object.values(PackageStatus).includes(status);
const releasesStock = (status) => STOCK_RELEASING.includes(status);
const canCustomerCancel = (status) => CUSTOMER_CANCELLABLE.includes(status);
const nextOrderStatuses = (status) => ORDER_TRANSITIONS[status] || [];
const nextPackageStatuses = (status) => PACKAGE_TRANSITIONS[status] || [];

function assertOrderTransition(from, to) {
  if (from === to) return;
  if (!nextOrderStatuses(from).includes(to)) {
    throw new ConflictError(`Sipariş "${from}" durumundan "${to}" durumuna geçemez.`);
  }
}

function assertPackageTransition(from, to) {
  if (from === to) return;
  if (!nextPackageStatuses(from).includes(to)) {
    throw new ConflictError(`Paket "${from}" durumundan "${to}" durumuna geçemez.`);
  }
}

/** Paketlerin durumundan siparişin genel durumunu türetir. */
function deriveOrderStatus(current, packageStatuses) {
  if (current === OrderStatus.PENDING_PAYMENT || current === OrderStatus.PAYMENT_FAILED) return current;
  if (!packageStatuses.length) return current;

  const every = (status) => packageStatuses.every((value) => value === status);
  const all = (statuses) => packageStatuses.every((value) => statuses.includes(value));

  if (every(PackageStatus.CANCELLED)) return OrderStatus.CANCELLED;
  if (all([PackageStatus.DELIVERED, PackageStatus.CANCELLED, PackageStatus.REFUNDED])) {
    return OrderStatus.COMPLETED;
  }
  return OrderStatus.PAID;
}

module.exports = {
  OrderStatus,
  PackageStatus,
  isOrderStatus,
  isPackageStatus,
  releasesStock,
  canCustomerCancel,
  nextOrderStatuses,
  nextPackageStatuses,
  assertOrderTransition,
  assertPackageTransition,
  deriveOrderStatus
};
