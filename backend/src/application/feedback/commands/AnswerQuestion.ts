"use strict";

import { Command, type Handler } from "../../shared/cqrs/Message";
import { NotFoundError } from "../../../domain/shared/errors";
import { requireUuid } from "../../../domain/shared/guards";
import { createAnswerBody } from "../../../domain/feedback/Feedback";
import { EventTypes, domainEvent } from "../../../domain/shared/DomainEvent";
import { assertCan, type UseCaseContext } from "../../shared/authorize";
import type { IdGenerator, Row, UnitOfWork } from "../../shared/contracts";

export class AnswerQuestionCommand extends Command {
  readonly productId: string;
  readonly questionId: string;
  readonly body: unknown;

  constructor(input?: { productId?: string; questionId?: string; body?: unknown }) {
    super();
    this.productId = input?.productId as string;
    this.questionId = input?.questionId as string;
    this.body = input?.body;
  }
}

/**
 * Ürün sorusunu yanıtlar.
 *
 * Yanıtlayabilen: ürünün MAĞAZASINDA talep yanıtlama izni olan (satıcı) ya
 * da yönetim. Yetki mağaza kapsamıyla soruluyor — başka bir mağazanın
 * satıcısı rakibinin ürününe yanıt yazamaz.
 *
 * Yanıtın altında kişinin adı değil MAĞAZANIN adı görünüyor: müşteri için
 * muhatap mağaza. Yönetim yanıtlarsa "Donanex Destek" yazıyor.
 *
 * Soru sahibine bildirim ve e-posta gidiyor (olay üzerinden).
 */
export class AnswerQuestionHandler implements Handler<AnswerQuestionCommand, Row, UseCaseContext> {
  private readonly unitOfWork: UnitOfWork;
  private readonly ids: IdGenerator;

  constructor({ unitOfWork, ids }: { unitOfWork: UnitOfWork; ids: IdGenerator }) {
    this.unitOfWork = unitOfWork;
    this.ids = ids;
  }

  async handle({ productId, questionId, body }: AnswerQuestionCommand, context: UseCaseContext = {}): Promise<Row> {
    requireUuid(productId, "Ürün numarası");
    requireUuid(questionId, "Soru numarası");
    const metin = createAnswerBody(body);

    return this.unitOfWork.run(async (repos) => {
      const urun = await repos.feedback.findProduct(productId);
      if (!urun) throw new NotFoundError("Ürün bulunamadı.");

      const policy = assertCan(context, "support:respond", { storeId: urun.storeId });
      const soru = await repos.feedback.findQuestion(questionId, productId);
      if (!soru) throw new NotFoundError("Soru bulunamadı.");

      const magazaUyesi = policy.storeIds.includes(urun.storeId);
      const yanit = await repos.feedback.addAnswer({
        id: this.ids.uuid(),
        questionId,
        userId: (context.actorId as string | null) ?? null,
        authorName: magazaUyesi ? urun.storeName : "Donanex Destek",
        body: metin
      });

      if (soru.userId) {
        await repos.outbox.add(
          domainEvent(EventTypes.PRODUCT_QUESTION_ANSWERED, "product", productId, {
            questionId,
            userId: soru.userId,
            email: soru.email,
            fullName: soru.fullName,
            productName: urun.name,
            storeSlug: urun.storeSlug,
            productSlug: urun.slug,
            question: soru.body,
            answer: metin,
            answeredBy: yanit.authorName
          })
        );
      }
      await repos.audit.record({
        actorId: (context.actorId as string | null) ?? null,
        action: "product.question_answered",
        resourceType: "product",
        resourceId: productId,
        metadata: { questionId, answerId: yanit.id },
        context
      });
      return yanit;
    });
  }
}
