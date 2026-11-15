"use strict";

import type { Db } from "../pool";
import type { FeedbackRepository, Row } from "../../../../application/shared/contracts";

const YORUM = `
  r.id, r.product_id AS "productId", r.user_id AS "userId", r.author_name AS "authorName",
  r.rating, r.body, r.verified_purchase AS "verifiedPurchase",
  r.created_at AS "createdAt", r.updated_at AS "updatedAt"`;

export class PgFeedbackRepository implements FeedbackRepository {
  private readonly db: Db;

  constructor(client: Db) {
    this.db = client;
  }

  async findProduct(productId: string): Promise<Row | null> {
    const { rows } = await this.db.query(
      `SELECT p.id, p.name, p.slug, p.status, p.store_id AS "storeId",
              s.slug AS "storeSlug", s.name AS "storeName", s.status AS "storeStatus"
       FROM products p JOIN stores s ON s.id = p.store_id
       WHERE p.id = $1`,
      [productId]
    );
    return rows[0] || null;
  }

  /**
   * Ödemesi alınmış (ya da tamamlanmış) bir siparişte, iptal/iade edilmemiş
   * bir pakette bu ürün var mı. Ödenmemiş ya da iptal edilmiş sipariş
   * "satın aldı" sayılmıyor.
   */
  async hasPurchased(userId: string, productId: string): Promise<boolean> {
    const { rows } = await this.db.query(
      `SELECT EXISTS (
         SELECT 1 FROM orders o
         JOIN order_packages op ON op.order_id = o.id
         JOIN order_items oi ON oi.package_id = op.id
         WHERE o.user_id = $1 AND oi.product_id = $2
           AND o.status IN ('paid', 'completed')
           AND op.status NOT IN ('cancelled', 'refunded')
       ) AS var`,
      [userId, productId]
    );
    return rows[0].var;
  }

  /**
   * Kişi başına ürün başına tek yorum.
   *
   * ON CONFLICT ile: ikinci gönderim yeni satır açmıyor, mevcut yorumu
   * güncelliyor. Kimlik değişmiyor (eski yoruma eklenmiş fotoğraflar
   * kaybolmasın) ve "created" yanıtta söyleniyor.
   */
  async upsertReview(review: {
    id: string;
    productId: string;
    userId: string;
    authorName: string;
    rating: number;
    body: string;
    verifiedPurchase: boolean;
  }): Promise<Row> {
    const { rows } = await this.db.query(
      `INSERT INTO product_reviews AS r (id, product_id, user_id, author_name, rating, body, verified_purchase)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (product_id, user_id) DO UPDATE
         SET rating = EXCLUDED.rating, body = EXCLUDED.body, author_name = EXCLUDED.author_name,
             verified_purchase = EXCLUDED.verified_purchase, updated_at = NOW()
       RETURNING ${YORUM}, (xmax = 0) AS created`,
      [
        review.id,
        review.productId,
        review.userId,
        review.authorName,
        review.rating,
        review.body,
        review.verifiedPurchase
      ]
    );
    return rows[0];
  }

  async lockReview(reviewId: string, productId: string): Promise<Row | null> {
    const { rows } = await this.db.query(
      `SELECT ${YORUM} FROM product_reviews r WHERE r.id = $1 AND r.product_id = $2 FOR UPDATE`,
      [reviewId, productId]
    );
    return rows[0] || null;
  }

  async countReviewPhotos(reviewId: string): Promise<number> {
    const { rows } = await this.db.query(
      "SELECT COUNT(*)::int AS n FROM product_review_photos WHERE review_id = $1",
      [reviewId]
    );
    return rows[0].n;
  }

  async addReviewPhoto(photo: { id: string; reviewId: string; imageUrl: string }): Promise<Row> {
    const { rows } = await this.db.query(
      `INSERT INTO product_review_photos (id, review_id, image_url) VALUES ($1, $2, $3)
       RETURNING id, image_url AS "imageUrl", created_at AS "createdAt"`,
      [photo.id, photo.reviewId, photo.imageUrl]
    );
    return rows[0];
  }

  async createQuestion(q: { id: string; productId: string; userId: string; authorName: string; body: string }): Promise<Row> {
    const { rows } = await this.db.query(
      `INSERT INTO product_questions (id, product_id, user_id, author_name, body) VALUES ($1, $2, $3, $4, $5)
       RETURNING id, product_id AS "productId", user_id AS "userId", author_name AS "authorName", body,
                 created_at AS "createdAt"`,
      [q.id, q.productId, q.userId, q.authorName, q.body]
    );
    return rows[0];
  }

  async findQuestion(questionId: string, productId: string): Promise<Row | null> {
    const { rows } = await this.db.query(
      `SELECT q.id, q.product_id AS "productId", q.user_id AS "userId", q.author_name AS "authorName", q.body,
              u.email, u.full_name AS "fullName"
       FROM product_questions q LEFT JOIN users u ON u.id = q.user_id
       WHERE q.id = $1 AND q.product_id = $2`,
      [questionId, productId]
    );
    return rows[0] || null;
  }

  async addAnswer(a: { id: string; questionId: string; userId: string | null; authorName: string; body: string }): Promise<Row> {
    const { rows } = await this.db.query(
      `INSERT INTO product_answers (id, question_id, user_id, author_name, body) VALUES ($1, $2, $3, $4, $5)
       RETURNING id, question_id AS "questionId", author_name AS "authorName", body, created_at AS "createdAt"`,
      [a.id, a.questionId, a.userId, a.authorName, a.body]
    );
    return rows[0];
  }
}
