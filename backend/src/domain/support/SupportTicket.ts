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

/**
 * Talep önceliği.
 *
 * Dört kademe var; daha fazlası ayırt edilemiyor. "Yüksek" ile "çok yüksek"
 * arasındaki farkı kimse tutarlı uygulamıyor ve sıralama anlamını yitiriyor.
 *
 * Önceliği TALEBİ AÇAN DEĞİL, bakan ekip veriyor (bkz. createTicket): aciliyet
 * müşteriye sorulsaydı herkes "acil" derdi ve alan hiçbir şey söylemezdi.
 */
export const TicketPriority = {
  LOW: "low",
  NORMAL: "normal",
  HIGH: "high",
  URGENT: "urgent"
} as const;

export type TicketPriorityKind = (typeof TicketPriority)[keyof typeof TicketPriority];

export const TICKET_PRIORITIES = Object.freeze(Object.values(TicketPriority)) as readonly TicketPriorityKind[];

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

/**
 * Destek talebi. Kayıtsız kullanıcı da açabilir.
 *
 * Girdide ÖNCELİK YOK ve bu bilinçli: talebi açan kişi aciliyetini kendisi
 * seçemiyor. Yeni talepler "normal" ile başlıyor (veritabanı varsayılanı),
 * önceliği talebe bakan ekip veriyor.
 */
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
  priority?: unknown;
}

export interface Reply {
  readonly status: TicketStatusKind;
  readonly body: string | null;
  /**
   * null = "dokunma".
   *
   * Yanıt formu önceliği her zaman göndermiyor; gönderilmediğinde mevcut
   * öncelik korunmalı. Varsayılan olarak "normal" konsaydı, yalnızca durum
   * güncelleyen bir istek acil bir talebi sessizce normale düşürürdü.
   */
  readonly priority: TicketPriorityKind | null;
}

export function createReply(input?: ReplyInput | null): Reply {
  const data = input ?? {};
  return Object.freeze({
    status: requireEnum(data.status ?? TicketStatus.ANSWERED, TICKET_STATUSES, "Talep durumu"),
    body: optionalText(data.body, "Yanıt", 5000),
    priority:
      data.priority === undefined || data.priority === null || data.priority === ""
        ? null
        : requireEnum(data.priority, TICKET_PRIORITIES, "Talep önceliği")
  });
}
