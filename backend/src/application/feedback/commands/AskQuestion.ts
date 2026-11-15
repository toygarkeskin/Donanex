"use strict";

import { Command, type Handler } from "../../shared/cqrs/Message";
import { NotFoundError, UnauthorizedError } from "../../../domain/shared/errors";
import { requireUuid } from "../../../domain/shared/guards";
import { createQuestionBody, publicDisplayName } from "../../../domain/feedback/Feedback";
import { EventTypes, domainEvent } from "../../../domain/shared/DomainEvent";
import type { UseCaseContext } from "../../shared/authorize";
import type { IdGenerator, Row, UnitOfWork } from "../../shared/contracts";

export class AskQuestionCommand extends Command {
  readonly productId: string;
  readonly userId: string | null;
  readonly body: unknown;

  constructor(input?: { productId?: string; userId?: string | null; body?: unknown }) {
    super();
    this.productId = input?.productId as string;
    this.userId = input?.userId ?? null;
    this.body = input?.body;
  }
}

/**
 * Ürüne soru sorar.
 *
 * Soru olay olarak outbox'a da yazılıyor: mağazanın bildirim kutusuna
 * "yeni ürün sorusu" düşüyor. Satıcı soruyu fark etmezse soru-cevap bölümü
 * yanıtsız sorularla dolu bir vitrine dönerdi.
 */
export class AskQuestionHandler implements Handler<AskQuestionCommand, Row, UseCaseContext> {
  private readonly unitOfWork: UnitOfWork;
  private readonly ids: IdGenerator;

  constructor({ unitOfWork, ids }: { unitOfWork: UnitOfWork; ids: IdGenerator }) {
    this.unitOfWork = unitOfWork;
    this.ids = ids;
  }

  async handle({ productId, userId, body }: AskQuestionCommand, context: UseCaseContext = {}): Promise<Row> {
    if (!userId) throw new UnauthorizedError("Soru sormak için giriş yapmalısınız.");
    requireUuid(productId, "Ürün numarası");
    const metin = createQuestionBody(body);

    return this.unitOfWork.run(async (repos) => {
      const urun = await repos.feedback.findProduct(productId);
      if (!urun || urun.status !== "active" || urun.storeStatus !== "active") {
        throw new NotFoundError("Ürün bulunamadı.");
      }
      const kisi = await repos.users.findById(userId);
      if (!kisi) throw new NotFoundError("Kullanıcı bulunamadı.");

      const soru = await repos.feedback.createQuestion({
        id: this.ids.uuid(),
        productId,
        userId,
        authorName: publicDisplayName(kisi.fullName),
        body: metin
      });

      await repos.outbox.add(
        domainEvent(EventTypes.PRODUCT_QUESTION_ASKED, "product", productId, {
          questionId: soru.id,
          storeId: urun.storeId,
          storeSlug: urun.storeSlug,
          productSlug: urun.slug,
          productName: urun.name,
          body: metin
        })
      );
      await repos.audit.record({
        actorId: userId,
        action: "product.question_asked",
        resourceType: "product",
        resourceId: productId,
        metadata: { questionId: soru.id },
        context
      });

      const { userId: _gizli, ...disari } = soru;
      return { ...disari, answers: [] };
    });
  }
}
