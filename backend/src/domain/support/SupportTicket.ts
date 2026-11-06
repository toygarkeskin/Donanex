"use strict";

import { requireText, requireEmail, requireEnum, optionalText } from "../shared/guards";

export const TicketStatus = {
  OPEN: "open",
  IN_PROGRESS: "in_progress",
  ANSWERED: "answered",
  CLOSED: "closed"
} as const;

export type TicketStatusKind = (typeof TicketStatus)[keyof typeof TicketStatus];

export const TICKET_STATUSES = Object.freeze(Object.values(TicketStatus)) as readonly TicketStatusKind[];

export interface TicketInput {
  email?: unknown;
  fullName?: unknown;
  subject?: unknown;
  message?: unknown;
  orderId?: string | null;
  storeId?: string | null;
}

export interface Ticket {
  readonly email: string;
  readonly fullName: string;
  readonly subject: string;
  readonly message: string;
  readonly orderId: string | null;
  readonly storeId: string | null;
  readonly status: TicketStatusKind;
}

/** Destek talebi. Kayıtsız kullanıcı da açabilir. */
export function createTicket(input?: TicketInput | null): Ticket {
  const data = input ?? {};
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

export interface ReplyInput {
  status?: unknown;
  body?: unknown;
}

export interface Reply {
  readonly status: TicketStatusKind;
  readonly body: string | null;
}

export function createReply(input?: ReplyInput | null): Reply {
  const data = input ?? {};
  return Object.freeze({
    status: requireEnum(data.status ?? TicketStatus.ANSWERED, TICKET_STATUSES, "Talep durumu"),
    body: optionalText(data.body, "Yanıt", 5000)
  });
}
