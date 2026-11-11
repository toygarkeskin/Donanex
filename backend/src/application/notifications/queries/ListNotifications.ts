"use strict";

import { Query, type Handler } from "../../shared/cqrs/Message";
import { bildirimAlicisi, type NotificationFeed } from "../alici";
import type { UseCaseContext } from "../../shared/authorize";
import type { NotificationReadModel, Row } from "../../shared/contracts";

export interface NotificationFilters {
  page?: unknown;
  pageSize?: unknown;
}

export class ListNotificationsQuery extends Query {
  readonly feed: NotificationFeed;
  readonly userId: string | null;
  readonly storeId: string | null;
  readonly filters: NotificationFilters;

  constructor(input?: {
    feed?: NotificationFeed;
    userId?: string | null;
    storeId?: string | null;
    filters?: NotificationFilters;
  }) {
    super();
    this.feed = input?.feed ?? "mine";
    this.userId = input?.userId ?? null;
    this.storeId = input?.storeId ?? null;
    this.filters = input?.filters ?? {};
  }
}

/**
 * Bildirim listesi. Okunmamış sayısı yanıtın içinde geliyor; zil hem sayıyı
 * hem listeyi aynı anın verisiyle gösteriyor.
 */
export class ListNotificationsHandler implements Handler<ListNotificationsQuery, Row, UseCaseContext> {
  private readonly readModel: NotificationReadModel;

  constructor({ notificationReadModel }: { notificationReadModel: NotificationReadModel }) {
    this.readModel = notificationReadModel;
  }

  handle({ feed, userId, storeId, filters }: ListNotificationsQuery, context: UseCaseContext = {}): Promise<Row> {
    const page = Math.max(1, Number(filters.page) || 1);
    // Üst sınır 50: zil paneli uzun bir liste için değil, son olanlar için.
    const pageSize = Math.min(50, Math.max(1, Number(filters.pageSize) || 15));
    const target = bildirimAlicisi(feed, { userId, storeId }, context);

    return this.readModel.list(target, { limit: pageSize, offset: (page - 1) * pageSize, page, pageSize });
  }
}
