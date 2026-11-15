"use strict";

import { Command, type Handler } from "../../shared/cqrs/Message";
import { NotFoundError, ConflictError, UnauthorizedError } from "../../../domain/shared/errors";
import { requireUuid } from "../../../domain/shared/guards";
import { createReview, publicDisplayName, type ReviewInput } from "../../../domain/feedback/Feedback";
import type { UseCaseContext } from "../../shared/authorize";
import type { IdGenerator, Row, UnitOfWork } from "../../shared/contracts";

export class SubmitReviewCommand extends Command {
  readonly productId: string;
  readonly userId: string | null;
  readonly data: ReviewInput | undefined;

  constructor(input?: { productId?: string; userId?: string | null; data?: ReviewInput }) {
    super();
    this.productId = input?.productId as string;
    this.userId = input?.userId ?? null;
    this.data = input?.data;
  }
}

/**
 * Ürüne yorum yazar ya da kişinin mevcut yorumunu günceller.
 *
 * Giriş ŞART (yorumun bir hesaba bağlı olması, sahte yorum yağmurunu
 * zorlaştırıyor); satın alma şart değil ama satın alanın yorumu "Satın aldı"
 * rozetiyle işaretleniyor. Rozet istemcinin beyanından değil, sipariş
 * kayıtlarından hesaplanıyor.
 *
 * Yayında olmayan ürüne (taslak, kapalı mağaza) yorum yazılamıyor: vitrinde
 * görünmeyen bir ürün için yorum, sayfası olmayan bir yorum olurdu.
 */
export class SubmitReviewHandler implements Handler<SubmitReviewCommand, Row, UseCaseContext> {
  private readonly unitOfWork: UnitOfWork;
  private readonly ids: IdGenerator;

  constructor({ unitOfWork, ids }: { unitOfWork: UnitOfWork; ids: IdGenerator }) {
    this.unitOfWork = unitOfWork;
    this.ids = ids;
  }

  async handle({ productId, userId, data }: SubmitReviewCommand, context: UseCaseContext = {}): Promise<Row> {
    if (!userId) throw new UnauthorizedError("Yorum yazmak için giriş yapmalısınız.");
    requireUuid(productId, "Ürün numarası");
    const review = createReview(data);

    const sonuc = await this.unitOfWork.run(async (repos) => {
      const urun = await repos.feedback.findProduct(productId);
      if (!urun || urun.status !== "active" || urun.storeStatus !== "active") {
        throw new NotFoundError("Ürün bulunamadı.");
      }
      const kisi = await repos.users.findById(userId);
      if (!kisi) throw new NotFoundError("Kullanıcı bulunamadı.");

      // Mağaza kendi ürününe yorum yazamaz: kendi ürününü öven yorum, okuyanı yanıltır.
      const policy = context.policy;
      if (policy && policy.storeIds.includes(urun.storeId)) {
        throw new ConflictError("Kendi mağazanızın ürününe yorum yazamazsınız.");
      }

      const kayit = await repos.feedback.upsertReview({
        id: this.ids.uuid(),
        productId,
        userId,
        authorName: publicDisplayName(kisi.fullName),
        rating: review.rating,
        body: review.body,
        verifiedPurchase: await repos.feedback.hasPurchased(userId, productId)
      });

      await repos.audit.record({
        actorId: userId,
        action: kayit.created ? "review.created" : "review.updated",
        resourceType: "product",
        resourceId: productId,
        metadata: { reviewId: kayit.id, rating: review.rating },
        context
      });
      return kayit;
    });

    const { userId: _gizli, ...disari } = sonuc;
    return disari;
  }
}
