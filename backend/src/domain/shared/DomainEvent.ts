"use strict";

/**
 * Domain olayları. Komut, işini yaptığı transaction içinde olay üretir;
 * olaylar outbox'a yazılır ve ayrı bir süreç tarafından kuyruğa aktarılır.
 * Böylece "veritabanına yazdım ama kuyruğa atamadım" durumu oluşmaz.
 */
export const EventTypes = {
  USER_REGISTERED: "user.registered",
  USER_PASSWORD_RESET_REQUESTED: "user.password_reset_requested",
  USER_PASSWORD_CHANGED: "user.password_changed",
  STORE_APPLIED: "store.applied",
  STORE_APPROVED: "store.approved",
  ORDER_PLACED: "order.placed",
  ORDER_PAID: "order.paid",
  ORDER_PAYMENT_FAILED: "order.payment_failed",
  ORDER_CANCELLED: "order.cancelled",
  PACKAGE_STATUS_CHANGED: "order.package_status_changed",
  SUPPORT_TICKET_OPENED: "support.ticket_opened",
  SUPPORT_TICKET_ANSWERED: "support.ticket_answered"
} as const;

/** Yalnızca yukarıdaki olay adları geçerlidir; yazım hatası derlemede yakalanır. */
export type EventType = (typeof EventTypes)[keyof typeof EventTypes];

/**
 * Olay içeriği.
 *
 * Olaylar KENDİ KENDİNE YETERLİ olmalıdır: tüketici alıcıyı yalnızca buradan
 * bulur, veritabanına geri dönmez. Bu yüzden e-posta üreten olaylara
 * "email" ve "fullName" konur.
 */
export type EventPayload = Record<string, unknown>;

export interface DomainEventShape {
  readonly type: EventType;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly payload: EventPayload;
  readonly occurredAt: string;
}

export function domainEvent(
  type: EventType,
  aggregateType: string,
  aggregateId: string,
  payload: EventPayload = {}
): DomainEventShape {
  return Object.freeze({ type, aggregateType, aggregateId, payload, occurredAt: new Date().toISOString() });
}
