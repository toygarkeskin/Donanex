"use strict";

import { ConflictError } from "../shared/errors";

/**
 * Sipariş iki seviyelidir:
 *
 *   Order   — müşterinin tek seferde verdiği sipariş ve ödemesi
 *   Package — her mağazaya düşen parça; kargoyu mağaza kendi yönetir
 *
 * Çok satıcılı yapıda bir sipariş birden çok mağazaya bölünebildiği için
 * kargo ve hazırlık durumu paket seviyesindedir.
 */
export const OrderStatus = {
  PENDING_PAYMENT: "pending_payment",
  PAID: "paid",
  PAYMENT_FAILED: "payment_failed",
  CANCELLED: "cancelled",
  COMPLETED: "completed"
} as const;

export type OrderStatusKind = (typeof OrderStatus)[keyof typeof OrderStatus];

export const PackageStatus = {
  // Ödeme bekleniyor ya da ödendi ama mağaza henüz hazırlığa başlamadı
  PENDING: "pending",
  PREPARING: "preparing",
  SHIPPED: "shipped",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
  REFUNDED: "refunded"
} as const;

export type PackageStatusKind = (typeof PackageStatus)[keyof typeof PackageStatus];

/*
 * Geçiş tabloları Record<...> ile tiplendi: durum eklenip tabloya satır
 * yazılmazsa derleme hata verir. Önceden eksik satır sessizce "hiçbir yere
 * geçemez" anlamına geliyordu.
 */
const ORDER_TRANSITIONS: Readonly<Record<OrderStatusKind, readonly OrderStatusKind[]>> = Object.freeze({
  [OrderStatus.PENDING_PAYMENT]: [OrderStatus.PAID, OrderStatus.PAYMENT_FAILED, OrderStatus.CANCELLED],
  [OrderStatus.PAID]: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
  [OrderStatus.PAYMENT_FAILED]: [],
  [OrderStatus.CANCELLED]: [],
  [OrderStatus.COMPLETED]: []
});

const PACKAGE_TRANSITIONS: Readonly<Record<PackageStatusKind, readonly PackageStatusKind[]>> = Object.freeze({
  [PackageStatus.PENDING]: [PackageStatus.PREPARING, PackageStatus.CANCELLED],
  [PackageStatus.PREPARING]: [PackageStatus.SHIPPED, PackageStatus.CANCELLED],
  [PackageStatus.SHIPPED]: [PackageStatus.DELIVERED],
  [PackageStatus.DELIVERED]: [PackageStatus.REFUNDED],
  [PackageStatus.CANCELLED]: [],
  [PackageStatus.REFUNDED]: []
});

/** Bu durumlara geçen paketin ayırdığı stok ürüne geri verilir. */
const STOCK_RELEASING: readonly PackageStatusKind[] = Object.freeze([
  PackageStatus.CANCELLED,
  PackageStatus.REFUNDED
]);

/** Müşteri kendi siparişini yalnızca hazırlık başlamadan iptal edebilir. */
const CUSTOMER_CANCELLABLE: readonly PackageStatusKind[] = Object.freeze([
  PackageStatus.PENDING,
  PackageStatus.PREPARING
]);

export const isOrderStatus = (status: unknown): status is OrderStatusKind =>
  (Object.values(OrderStatus) as unknown[]).includes(status);

export const isPackageStatus = (status: unknown): status is PackageStatusKind =>
  (Object.values(PackageStatus) as unknown[]).includes(status);

export const releasesStock = (status: PackageStatusKind): boolean => STOCK_RELEASING.includes(status);

export const canCustomerCancel = (status: PackageStatusKind): boolean => CUSTOMER_CANCELLABLE.includes(status);

export const nextOrderStatuses = (status: OrderStatusKind): readonly OrderStatusKind[] =>
  ORDER_TRANSITIONS[status] ?? [];

export const nextPackageStatuses = (status: PackageStatusKind): readonly PackageStatusKind[] =>
  PACKAGE_TRANSITIONS[status] ?? [];

export function assertOrderTransition(from: OrderStatusKind, to: OrderStatusKind): void {
  if (from === to) return;
  if (!nextOrderStatuses(from).includes(to)) {
    throw new ConflictError(`Sipariş "${from}" durumundan "${to}" durumuna geçemez.`);
  }
}

export function assertPackageTransition(from: PackageStatusKind, to: PackageStatusKind): void {
  if (from === to) return;
  if (!nextPackageStatuses(from).includes(to)) {
    throw new ConflictError(`Paket "${from}" durumundan "${to}" durumuna geçemez.`);
  }
}

/** Paketlerin durumundan siparişin genel durumunu türetir. */
export function deriveOrderStatus(
  current: OrderStatusKind,
  packageStatuses: readonly PackageStatusKind[]
): OrderStatusKind {
  if (current === OrderStatus.PENDING_PAYMENT || current === OrderStatus.PAYMENT_FAILED) return current;
  if (!packageStatuses.length) return current;

  const every = (status: PackageStatusKind) => packageStatuses.every((value) => value === status);
  const all = (statuses: readonly PackageStatusKind[]) =>
    packageStatuses.every((value) => statuses.includes(value));

  if (every(PackageStatus.CANCELLED)) return OrderStatus.CANCELLED;
  if (all([PackageStatus.DELIVERED, PackageStatus.CANCELLED, PackageStatus.REFUNDED])) {
    return OrderStatus.COMPLETED;
  }
  return OrderStatus.PAID;
}
