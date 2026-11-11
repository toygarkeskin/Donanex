"use strict";

import { Command, type Handler } from "../../shared/cqrs/Message";
import { bildirimAlicisi, type NotificationFeed } from "../alici";
import type { UseCaseContext } from "../../shared/authorize";
import type { UnitOfWork } from "../../shared/contracts";

export class MarkAllNotificationsReadCommand extends Command {
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

export interface MarkAllReadResult {
  readonly marked: number;
}

/**
 * "Tümünü okundu işaretle".
 *
 * Hiç okunmamış bildirim yoksa hata DEĞİL, marked: 0 döner: düğmeye iki kez
 * basmak bir hata durumu değil.
 */
export class MarkAllNotificationsReadHandler
  implements Handler<MarkAllNotificationsReadCommand, MarkAllReadResult, UseCaseContext>
{
  private readonly unitOfWork: UnitOfWork;

  constructor({ unitOfWork }: { unitOfWork: UnitOfWork }) {
    this.unitOfWork = unitOfWork;
  }

  async handle(
    { feed, userId, storeId }: MarkAllNotificationsReadCommand,
    context: UseCaseContext = {}
  ): Promise<MarkAllReadResult> {
    const target = bildirimAlicisi(feed, { userId, storeId }, context);
    return { marked: await this.unitOfWork.run((repos) => repos.notifications.markAllRead(target)) };
  }
}
