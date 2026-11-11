"use strict";

import { Command, type Handler } from "../../shared/cqrs/Message";
import { NotFoundError } from "../../../domain/shared/errors";
import { requireUuid } from "../../../domain/shared/guards";
import { bildirimAlicisi, type NotificationFeed } from "../alici";
import type { UseCaseContext } from "../../shared/authorize";
import type { UnitOfWork } from "../../shared/contracts";

export class MarkNotificationReadCommand extends Command {
  readonly feed: NotificationFeed;
  readonly userId: string | null;
  readonly storeId: string | null;
  readonly notificationId: string;

  constructor(input?: {
    feed?: NotificationFeed;
    userId?: string | null;
    storeId?: string | null;
    notificationId?: string;
  }) {
    super();
    this.feed = input?.feed ?? "mine";
    this.userId = input?.userId ?? null;
    this.storeId = input?.storeId ?? null;
    this.notificationId = input?.notificationId as string;
  }
}

export interface MarkReadResult {
  readonly notificationId: string;
}

/**
 * Tek bildirimi okundu işaretler.
 *
 * Başkasının bildirimi ile hiç olmayan bildirim AYNI yanıtı alır: numara
 * deneyerek bir bildirimin varlığı öğrenilemez.
 */
export class MarkNotificationReadHandler
  implements Handler<MarkNotificationReadCommand, MarkReadResult, UseCaseContext>
{
  private readonly unitOfWork: UnitOfWork;

  constructor({ unitOfWork }: { unitOfWork: UnitOfWork }) {
    this.unitOfWork = unitOfWork;
  }

  async handle(
    { feed, userId, storeId, notificationId }: MarkNotificationReadCommand,
    context: UseCaseContext = {}
  ): Promise<MarkReadResult> {
    requireUuid(notificationId, "Bildirim numarası");
    const target = bildirimAlicisi(feed, { userId, storeId }, context);

    const found = await this.unitOfWork.run((repos) => repos.notifications.markRead(target, notificationId));
    if (!found) throw new NotFoundError("Bildirim bulunamadı.");
    return { notificationId };
  }
}
