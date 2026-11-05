"use strict";

const { requireText, requireEmail, requireEnum, optionalText } = require("../shared/guards");

const TicketStatus = Object.freeze({
  OPEN: "open",
  IN_PROGRESS: "in_progress",
  ANSWERED: "answered",
  CLOSED: "closed"
});

const TICKET_STATUSES = Object.freeze(Object.values(TicketStatus));

/** Destek talebi. Kayıtsız kullanıcı da açabilir. */
function createTicket(input) {
  const data = input || {};
  return Object.freeze({
    email: requireEmail(data.email),
    fullName: requireText(data.fullName, "Ad Soyad", 150),
    subject: requireText(data.subject, "Konu", 200),
    message: requireText(data.message, "Mesaj", 5000),
    orderId: data.orderId ?? null,
    storeId: data.storeId ?? null,
    status: TicketStatus.OPEN
  });
}

function createReply(input) {
  const data = input || {};
  return Object.freeze({
    status: requireEnum(data.status ?? TicketStatus.ANSWERED, TICKET_STATUSES, "Talep durumu"),
    body: optionalText(data.body, "Yanıt", 5000)
  });
}

module.exports = { TicketStatus, TICKET_STATUSES, createTicket, createReply };
