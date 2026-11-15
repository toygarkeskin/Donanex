"use strict";

import type { RouteContext } from "../types";

import { kullanici, yol } from "../support/params";
import { Router, raw } from "express";
import {
  SubmitReviewCommand,
  AddReviewPhotoCommand,
  AskQuestionCommand,
  AnswerQuestionCommand,
  ListReviewsQuery,
  ListQuestionsQuery
} from "../../../application/feedback";
import { requireAuth } from "../middleware/authenticate";

/**
 * Ürün yorumları ve soru-cevap.
 *
 * Okumak herkese açık (ürün sayfası misafire de açık), yazmak giriş ister.
 * Yazma uçları talep açma ile aynı hız sınırını kullanıyor: kullanıcı
 * tarafından üretilen serbest metin, otomatik doldurulmaya en açık yer.
 *
 * Adres "/urunler/:productId/…": vitrindeki "/products/:magaza/:urun"
 * ile çakışmasın diye ayrı bir ön ek — "/products/<id>/yorumlar" yazılsaydı
 * yönlendirici onu "mağaza=<id>, ürün=yorumlar" diye okurdu.
 */
export function feedbackRoutes({ commands, queries, limiters }: Pick<RouteContext, "commands" | "queries" | "limiters">): Router {
  const router = Router();

  /* ----- yorumlar ----- */

  router.get("/urunler/:productId/yorumlar", async (req, res) => {
    res.json(await queries.ask(new ListReviewsQuery({ productId: yol(req, "productId"), filters: req.query })));
  });

  router.post("/urunler/:productId/yorumlar", requireAuth, limiters.support, async (req, res) => {
    const yorum = await commands.execute<{ created?: boolean }>(
      new SubmitReviewCommand({ productId: yol(req, "productId"), userId: kullanici(req), data: req.body }),
      req.context()
    );
    res.status(yorum.created ? 201 : 200).json(yorum);
  });

  router.post(
    "/urunler/:productId/yorumlar/:reviewId/fotograflar",
    requireAuth,
    limiters.support,
    // Tür listesi yalnızca kapı: gerçek tür görsel deposunda baytlardan okunuyor.
    raw({ type: ["image/png", "image/jpeg", "image/webp"], limit: "3mb" }),
    async (req, res) => {
      if (!Buffer.isBuffer(req.body) || !req.body.length) {
        res.status(415).json({
          error: "unsupported_media_type",
          message: "Fotoğraf PNG, JPEG ya da WebP olmalı ve ham veri olarak gönderilmeli."
        });
        return;
      }
      const foto = await commands.execute(
        new AddReviewPhotoCommand({
          productId: yol(req, "productId"),
          reviewId: yol(req, "reviewId"),
          userId: kullanici(req),
          content: req.body
        }),
        req.context()
      );
      res.status(201).json(foto);
    }
  );

  /* ----- soru-cevap ----- */

  router.get("/urunler/:productId/sorular", async (req, res) => {
    res.json(await queries.ask(new ListQuestionsQuery({ productId: yol(req, "productId"), filters: req.query })));
  });

  router.post("/urunler/:productId/sorular", requireAuth, limiters.support, async (req, res) => {
    const soru = await commands.execute(
      new AskQuestionCommand({ productId: yol(req, "productId"), userId: kullanici(req), body: req.body?.body }),
      req.context()
    );
    res.status(201).json(soru);
  });

  router.post("/urunler/:productId/sorular/:questionId/yanit", requireAuth, async (req, res) => {
    const yanit = await commands.execute(
      new AnswerQuestionCommand({
        productId: yol(req, "productId"),
        questionId: yol(req, "questionId"),
        body: req.body?.body
      }),
      req.context()
    );
    res.status(201).json(yanit);
  });

  return router;
}
