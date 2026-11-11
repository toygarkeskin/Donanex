"use strict";

import { Command, type Handler } from "../../shared/cqrs/Message";
import type { UseCaseContext } from "../../shared/authorize";
import type { IdGenerator, NotificationScope, Row, UnitOfWork } from "../../shared/contracts";

/** Yazılacak bildirim; numarasını handler üretir. */
export interface NotificationDraft {
  readonly scope: NotificationScope;
  readonly scopeId: string | null;
  readonly kind: string;
  readonly title: string;
  readonly body?: string;
  readonly url?: string | null;
}

export class RecordNotificationsCommand extends Command {
  /** Bildirimleri doğuran olayın numarası; tekilleştirme buna bakar. */
  readonly sourceEventId: string | null;
  readonly drafts: readonly NotificationDraft[];

  constructor(input?: { sourceEventId?: string | null; drafts?: readonly NotificationDraft[] }) {
    super();
    this.sourceEventId = input?.sourceEventId ?? null;
    this.drafts = input?.drafts ?? [];
  }
}

export interface RecordedNotifications {
  /** GERÇEKTEN yazılan satırlar; ikinci teslimde boş döner. */
  readonly items: Row[];
}

/**
 * Bildirimleri yazar.
 *
 * Çağıran worker'daki bildirim tüketicisidir: kuyruktan gelen olayı metne
 * çevirir ve bu komutu çağırır. Yetki denetimi YOK, çünkü çağıran bir
 * kullanıcı değil sistemin kendisi — bakım işlerinde olduğu gibi. Bu komutu
 * hiçbir HTTP rotası açmıyor; açılacak olsa denetim eklenmesi gerekir.
 *
 * Dönen liste yalnızca yeni satırları taşır. Tüketici gerçek zamanlı yayını
 * buna göre yapıyor: aynı olay ikinci kez teslim edildiğinde ne satır yazılır
 * ne de ekranda ikinci bir bildirim belirir.
 */
export class RecordNotificationsHandler
  implements Handler<RecordNotificationsCommand, RecordedNotifications, UseCaseContext>
{
  private readonly unitOfWork: UnitOfWork;
  private readonly ids: IdGenerator;

  constructor({ unitOfWork, ids }: { unitOfWork: UnitOfWork; ids: IdGenerator }) {
    this.unitOfWork = unitOfWork;
    this.ids = ids;
  }

  async handle({ sourceEventId, drafts }: RecordNotificationsCommand): Promise<RecordedNotifications> {
    if (!drafts.length) return { items: [] };

    const items = drafts.map((draft) => ({ ...draft, id: this.ids.uuid() }));
    return { items: await this.unitOfWork.run((repos) => repos.notifications.addMany({ sourceEventId, items })) };
  }
}
