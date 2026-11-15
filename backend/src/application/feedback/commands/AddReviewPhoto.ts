"use strict";

import { Command, type Handler } from "../../shared/cqrs/Message";
import { ConflictError, NotFoundError, UnauthorizedError } from "../../../domain/shared/errors";
import { requireUuid } from "../../../domain/shared/guards";
import { MAX_REVIEW_PHOTOS } from "../../../domain/feedback/Feedback";
import type { UseCaseContext } from "../../shared/authorize";
import type { FileStorage, IdGenerator, Row, UnitOfWork } from "../../shared/contracts";

export class AddReviewPhotoCommand extends Command {
  readonly productId: string;
  readonly reviewId: string;
  readonly userId: string | null;
  readonly content: Buffer;

  constructor(input?: { productId?: string; reviewId?: string; userId?: string | null; content?: Buffer }) {
    super();
    this.productId = input?.productId as string;
    this.reviewId = input?.reviewId as string;
    this.userId = input?.userId ?? null;
    this.content = input?.content as Buffer;
  }
}

/**
 * Yoruma fotoğraf ekler (en fazla 3, PNG/JPEG/WebP, 2 MB).
 *
 * Fotoğraf yorum YAZILDIKTAN sonra ekleniyor ve yalnızca yorumun sahibi
 * ekleyebiliyor. Önce yükleyip sonra yoruma bağlamak (ürün görsellerindeki
 * gibi) burada seçilmedi: yorum yazan çok daha fazla kişi var ve hiçbir
 * kayda bağlanmayan yüklemeler diski doldurmanın yolu olurdu.
 *
 * Fotoğraflar herkese açık klasöre yazılıyor (yorum herkese açık bir
 * sayfada); tür ve boyut denetimi görsel deposunun, baytlara bakarak.
 * Kayıt yazılamazsa (sınır aşıldı) diske yazılan dosya siliniyor.
 */
export class AddReviewPhotoHandler implements Handler<AddReviewPhotoCommand, Row, UseCaseContext> {
  private readonly unitOfWork: UnitOfWork;
  private readonly fileStorage: FileStorage;
  private readonly ids: IdGenerator;

  constructor({ unitOfWork, fileStorage, ids }: { unitOfWork: UnitOfWork; fileStorage: FileStorage; ids: IdGenerator }) {
    this.unitOfWork = unitOfWork;
    this.fileStorage = fileStorage;
    this.ids = ids;
  }

  async handle({ productId, reviewId, userId, content }: AddReviewPhotoCommand, context: UseCaseContext = {}): Promise<Row> {
    if (!userId) throw new UnauthorizedError("Fotoğraf eklemek için giriş yapmalısınız.");
    requireUuid(productId, "Ürün numarası");
    requireUuid(reviewId, "Yorum numarası");

    const kayit = await this.fileStorage.save(content);
    try {
      return await this.unitOfWork.run(async (repos) => {
        const yorum = await repos.feedback.lockReview(reviewId, productId);
        // Başkasının yorumu ile hiç olmayan yorum aynı yanıtı alır.
        if (!yorum || yorum.userId !== userId) throw new NotFoundError("Yorum bulunamadı.");
        if ((await repos.feedback.countReviewPhotos(reviewId)) >= MAX_REVIEW_PHOTOS) {
          throw new ConflictError(`Bir yoruma en fazla ${MAX_REVIEW_PHOTOS} fotoğraf eklenebilir.`);
        }
        const foto = await repos.feedback.addReviewPhoto({
          id: this.ids.uuid(),
          reviewId,
          imageUrl: `/yuklenen/${kayit.fileName}`
        });
        await repos.audit.record({
          actorId: userId,
          action: "review.photo_added",
          resourceType: "product",
          resourceId: productId,
          metadata: { reviewId, photoId: foto.id },
          context
        });
        return foto;
      });
    } catch (error) {
      await this.fileStorage.remove(kayit.fileName);
      throw error;
    }
  }
}
