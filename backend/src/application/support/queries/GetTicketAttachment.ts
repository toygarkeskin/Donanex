"use strict";

import { Query, type Handler } from "../../shared/cqrs/Message";
import { NotFoundError, ValidationError } from "../../../domain/shared/errors";
import { requireUuid } from "../../../domain/shared/guards";
import { assertCan, type UseCaseContext } from "../../shared/authorize";
import type { AttachmentStorage, SupportReadModel } from "../../shared/contracts";
import type { TicketScope } from "./GetTicket";

export class GetTicketAttachmentQuery extends Query {
  readonly scope: TicketScope;
  readonly ticketId: string;
  readonly attachmentId: string;
  readonly userId: string | null;
  readonly storeId: string | null;

  constructor(input?: {
    scope?: TicketScope;
    ticketId?: string;
    attachmentId?: string;
    userId?: string | null;
    storeId?: string | null;
  }) {
    super();
    this.scope = input?.scope as TicketScope;
    this.ticketId = input?.ticketId as string;
    this.attachmentId = input?.attachmentId as string;
    this.userId = input?.userId ?? null;
    this.storeId = input?.storeId ?? null;
  }
}

export interface AttachmentFile {
  readonly content: Buffer;
  readonly contentType: string;
  readonly originalName: string;
}

/**
 * Eki indirir.
 *
 * Yetki talebi görme yetkisiyle AYNI: talebi görebilen ekini de görebilir.
 * Kapsam read model sorgusunun içinde — ek kimliğini tahmin etmek, başkasının
 * talebindeki dosyaya ulaşmaya yetmiyor.
 *
 * "mine" kapsamında kullanıcı numarası ZORUNLU: read model'de boş kullanıcı
 * "süzme" anlamına geliyor, yani eksik numara bütün talepleri açardı. Bu
 * kapı rota sırasına güvenmiyor, burada ayrıca kapatılıyor.
 */
export class GetTicketAttachmentHandler implements Handler<GetTicketAttachmentQuery, AttachmentFile, UseCaseContext> {
  private readonly readModel: SupportReadModel;
  private readonly attachmentStorage: AttachmentStorage;

  constructor({
    supportReadModel,
    attachmentStorage
  }: {
    supportReadModel: SupportReadModel;
    attachmentStorage: AttachmentStorage;
  }) {
    this.readModel = supportReadModel;
    this.attachmentStorage = attachmentStorage;
  }

  async handle(
    { scope, ticketId, attachmentId, userId, storeId }: GetTicketAttachmentQuery,
    context: UseCaseContext = {}
  ): Promise<AttachmentFile> {
    requireUuid(ticketId, "Talep numarası");
    requireUuid(attachmentId, "Ek numarası");
    if (scope === "store") assertCan(context, "support:read", { storeId });
    else if (scope === "admin") assertCan(context, "support:read");
    else if (!userId) throw new ValidationError("Kullanıcı numarası gerekli.");

    const ek = await this.readModel.getAttachment(ticketId, attachmentId, {
      userId: scope === "mine" ? userId : null,
      storeId: scope === "store" ? storeId : null
    });
    if (!ek) throw new NotFoundError("Ek bulunamadı.");

    const { content, contentType } = await this.attachmentStorage.read(ek.fileName);
    return { content, contentType, originalName: ek.originalName };
  }
}
