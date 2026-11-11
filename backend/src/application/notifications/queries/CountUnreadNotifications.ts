"use strict";

import { Query, type Handler } from "../../shared/cqrs/Message";
import { bildirimAlicisi, type NotificationFeed } from "../alici";
import type { UseCaseContext } from "../../shared/authorize";
import type { NotificationReadModel } from "../../shared/contracts";

export class CountUnreadNotificationsQuery extends Query {
  readonly feed: NotificationFeed;
  readonly userId: string | null;
  readonly storeId: string | null;

  constructor(input?: { feed?: NotificationFeed; userId?: string | null; storeId?: string | null }) {
    super();
    this.feed = input?.feed ?? "mine";
    this.userId = input?.userId ?? null;
    this.storeId = input?.storeId ?? null;
  }
}

export interface UnreadCount {
  readonly unread: number;
}

/**
 * Yalnızca okunmamış sayısı.
 *
 * Neden ayrı bir uç: gerçek zamanlı bağlantı kurulamadığında istemci yoklamaya
 * düşüyor ve yoklama DAKİKADA bir çalışıyor. Liste ucunu çağırmak her seferinde
 * on beş satır taşımak demekti; burada tek sayı dönüyor ve indeks yalnızca
 * okunmamışları tuttuğu için sorgu tabloyu hiç taramıyor.
 */
export class CountUnreadNotificationsHandler
  implements Handler<CountUnreadNotificationsQuery, UnreadCount, UseCaseContext>
{
  private readonly readModel: NotificationReadModel;

  constructor({ notificationReadModel }: { notificationReadModel: NotificationReadModel }) {
    this.readModel = notificationReadModel;
  }

  async handle(
    { feed, userId, storeId }: CountUnreadNotificationsQuery,
    context: UseCaseContext = {}
  ): Promise<UnreadCount> {
    const target = bildirimAlicisi(feed, { userId, storeId }, context);
    return { unread: await this.readModel.countUnread(target) };
  }
}
