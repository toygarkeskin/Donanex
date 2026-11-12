"use strict";

import { Command, type Handler } from "../../shared/cqrs/Message";
import { ConflictError, NotFoundError, ValidationError } from "../../../domain/shared/errors";
import { requireUuid } from "../../../domain/shared/guards";
import { TicketStatus } from "../../../domain/support/SupportTicket";
import { MAX_ATTACHMENTS_PER_TICKET, displayFileName } from "../../../domain/support/Attachment";
import { assertCan, type UseCaseContext } from "../../shared/authorize";
import type { AttachmentStorage, IdGenerator, Row, UnitOfWork } from "../../shared/contracts";
import type { TicketScope } from "../queries/GetTicket";

export class AddTicketAttachmentCommand extends Command {
  readonly scope: TicketScope;
  readonly ticketId: string;
  readonly userId: string | null;
  readonly storeId: string | null;
  readonly originalName: unknown;
  readonly content: Buffer;

  constructor(input?: {
    scope?: TicketScope;
    ticketId?: string;
    userId?: string | null;
    storeId?: string | null;
    originalName?: unknown;
    content?: Buffer;
  }) {
    super();
    this.scope = input?.scope as TicketScope;
    this.ticketId = input?.ticketId as string;
    this.userId = input?.userId ?? null;
    this.storeId = input?.storeId ?? null;
    this.originalName = input?.originalName;
    this.content = input?.content as Buffer;
  }
}

/**
 * Talebe dosya ekler.
 *
 * Kim ekleyebilir:
 *   mine  → talebin SAHİBİ olan müşteri (kapalı talebe ekleyemez)
 *   store → o mağazada talep yanıtlama izni olan
 *   admin → sistem genelinde talep yanıtlama izni olan
 *
 * Sıra bilinçli:
 *   1. Yetki ve biçim denetimi — dosyaya hiç dokunmadan.
 *   2. Dosya diske yazılır; tür ve boyut BURADA, baytlara bakılarak denetlenir.
 *   3. Kayıt, talep kilitlenerek yazılır ve ek sayısı o kilit altında sayılır.
 *   4. Kayıt yazılamazsa (sınır aşıldı, talep kapandı) dosya silinir.
 *
 * Dosyayı transaction'dan ÖNCE yazmak zorundayız (disk işlemi geri
 * alınamıyor); o yüzden başarısızlıkta temizlik açıkça yapılıyor, yoksa
 * diskte hiçbir kayda bağlı olmayan dosyalar birikirdi.
 */
export class AddTicketAttachmentHandler implements Handler<AddTicketAttachmentCommand, Row, UseCaseContext> {
  private readonly unitOfWork: UnitOfWork;
  private readonly attachmentStorage: AttachmentStorage;
  private readonly ids: IdGenerator;

  constructor({
    unitOfWork,
    attachmentStorage,
    ids
  }: {
    unitOfWork: UnitOfWork;
    attachmentStorage: AttachmentStorage;
    ids: IdGenerator;
  }) {
    this.unitOfWork = unitOfWork;
    this.attachmentStorage = attachmentStorage;
    this.ids = ids;
  }

  async handle(
    { scope, ticketId, userId, storeId, originalName, content }: AddTicketAttachmentCommand,
    context: UseCaseContext = {}
  ): Promise<Row> {
    requireUuid(ticketId, "Talep numarası");
    if (scope === "store") assertCan(context, "support:respond", { storeId });
    else if (scope === "admin") assertCan(context, "support:respond");
    else if (!userId) throw new ValidationError("Kullanıcı numarası gerekli.");

    const kayit = await this.attachmentStorage.save(content);

    try {
      return await this.unitOfWork.run(async (repos) => {
        const ticket = await repos.support.lockTicket(ticketId, scope === "store" ? storeId : null);
        /*
         * Müşteri için sahiplik denetimi: başkasının talebi ile hiç olmayan
         * talep AYNI yanıtı alır, numara deneyerek talep varlığı öğrenilemez.
         */
        if (!ticket || (scope === "mine" && ticket.userId !== userId)) {
          throw new NotFoundError("Talep bulunamadı.");
        }
        if (scope === "mine" && ticket.status === TicketStatus.CLOSED) {
          throw new ConflictError("Kapatılmış talebe ek eklenemez.");
        }
        if ((await repos.support.countAttachments(ticketId)) >= MAX_ATTACHMENTS_PER_TICKET) {
          throw new ConflictError(`Bir talebe en fazla ${MAX_ATTACHMENTS_PER_TICKET} ek eklenebilir.`);
        }

        const ek = await repos.support.addAttachment({
          id: this.ids.uuid(),
          ticketId,
          uploadedBy: context.actorId ?? userId ?? null,
          isStaff: scope !== "mine",
          fileName: kayit.fileName,
          originalName: displayFileName(originalName),
          contentType: kayit.contentType,
          sizeBytes: kayit.size
        });

        await repos.audit.record({
          actorId: context.actorId ?? userId ?? null,
          action: "support.attachment_added",
          resourceType: "support_ticket",
          resourceId: ticketId,
          metadata: { attachmentId: ek.id, contentType: kayit.contentType, size: kayit.size },
          context
        });
        return ek;
      });
    } catch (error) {
      await this.attachmentStorage.remove(kayit.fileName);
      throw error;
    }
  }
}
