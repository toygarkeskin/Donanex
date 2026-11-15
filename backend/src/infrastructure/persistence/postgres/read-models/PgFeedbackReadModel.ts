"use strict";

import type { Pool } from "pg";
import { paginate } from "./sql";
import type { FeedbackReadModel, ListFilters, Row } from "../../../../application/shared/contracts";

/*
 * Kullanıcı kimliği (user_id) HİÇBİR yanıtta yok: herkese açık sayfada
 * kişinin hesap numarası görünmemeli. "Bu yorum benim mi" bilgisi istemcide
 * gerekmiyor — yorum gönderimi zaten kişinin kendi yorumunu güncelliyor.
 */
export class PgFeedbackReadModel implements FeedbackReadModel {
  private readonly db: Pool;

  constructor(pool: Pool) {
    this.db = pool;
  }

  async listReviews(productId: string, paging: ListFilters): Promise<Row> {
    /*
     * Özet tek sorguda: ortalama, adet ve yıldız dağılımı. Dağılım beş
     * elemanlı bir dizi (5 yıldızdan 1'e) — "4 yıldız: 12" çubukları buradan.
     */
    const ozet = await this.db.query(
      `SELECT COUNT(*)::int AS count,
              COALESCE(ROUND(AVG(rating)::numeric, 1), 0)::float AS average,
              ARRAY[
                COUNT(*) FILTER (WHERE rating = 5), COUNT(*) FILTER (WHERE rating = 4),
                COUNT(*) FILTER (WHERE rating = 3), COUNT(*) FILTER (WHERE rating = 2),
                COUNT(*) FILTER (WHERE rating = 1)
              ]::int[] AS distribution,
              COUNT(*) FILTER (WHERE verified_purchase)::int AS "verifiedCount"
       FROM product_reviews WHERE product_id = $1`,
      [productId]
    );
    const { rows } = await this.db.query(
      `SELECT r.id, r.author_name AS "authorName", r.rating, r.body,
              r.verified_purchase AS "verifiedPurchase",
              r.created_at AS "createdAt", r.updated_at AS "updatedAt",
              COALESCE((
                SELECT json_agg(json_build_object('id', ph.id, 'imageUrl', ph.image_url) ORDER BY ph.created_at)
                FROM product_review_photos ph WHERE ph.review_id = r.id
              ), '[]'::json) AS photos
       FROM product_reviews r
       WHERE r.product_id = $1
       -- Fotoğraflı ve satın almış kişinin yorumu önce: okuyana en çok
       -- bilgi veren yorumlar. Sonra en yeni.
       ORDER BY r.verified_purchase DESC,
                EXISTS (SELECT 1 FROM product_review_photos ph WHERE ph.review_id = r.id) DESC,
                r.created_at DESC
       LIMIT $2 OFFSET $3`,
      [productId, paging.limit, paging.offset]
    );
    return { ...paginate(rows, ozet.rows[0].count, paging), summary: ozet.rows[0] };
  }

  async listQuestions(productId: string, paging: ListFilters): Promise<Row> {
    const sayim = await this.db.query("SELECT COUNT(*)::int AS total FROM product_questions WHERE product_id = $1", [
      productId
    ]);
    const { rows } = await this.db.query(
      `SELECT q.id, q.author_name AS "authorName", q.body, q.created_at AS "createdAt",
              COALESCE((
                SELECT json_agg(json_build_object(
                  'id', a.id, 'authorName', a.author_name, 'body', a.body, 'createdAt', a.created_at
                ) ORDER BY a.created_at)
                FROM product_answers a WHERE a.question_id = q.id
              ), '[]'::json) AS answers
       FROM product_questions q
       WHERE q.product_id = $1
       -- Yanıtlanmış sorular önce: okuyan için değeri olan onlar.
       ORDER BY EXISTS (SELECT 1 FROM product_answers a WHERE a.question_id = q.id) DESC, q.created_at DESC
       LIMIT $2 OFFSET $3`,
      [productId, paging.limit, paging.offset]
    );
    return paginate(rows, sayim.rows[0].total, paging);
  }
}
