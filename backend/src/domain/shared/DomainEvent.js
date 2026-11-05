"use strict";

/**
 * Domain olayları. Komut, işini yaptığı transaction içinde olay üretir;
 * olaylar outbox'a yazılır ve ayrı bir süreç tarafından kuyruğa aktarılır.
 * Böylece "veritabanına yazdım ama kuyruğa atamadım" durumu oluşmaz.
 */
const EventTypes = Object.freeze({
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
});

function domainEvent(type, aggregateType, aggregateId, payload = {}) {
  return Object.freeze({ type, aggregateType, aggregateId, payload, occurredAt: new Date().toISOString() });
}

module.exports = { EventTypes, domainEvent };
