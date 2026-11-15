"use strict";

import { defineContext } from "../shared/registry";

import * as SubmitReview from "./commands/SubmitReview";
import * as AddReviewPhoto from "./commands/AddReviewPhoto";
import * as AskQuestion from "./commands/AskQuestion";
import * as AnswerQuestion from "./commands/AnswerQuestion";
import * as ListReviews from "./queries/ListReviews";
import * as ListQuestions from "./queries/ListQuestions";

/*
 * Geri bildirim bağlamı: ürün yorumları ve soru-cevap.
 *
 * Katalogdan AYRI bir bağlam, çünkü yazanı farklı: katalog mağazanın yazdığı
 * içerik, burası müşterinin. Yetki kuralları da farklı — müşteri her ürüne
 * yorum yazabilir ama hiçbir ürünü düzenleyemez.
 */
export = defineContext({
  name: "feedback",
  commands: {
    SubmitReview,
    AddReviewPhoto,
    AskQuestion,
    AnswerQuestion
  },
  queries: {
    ListReviews,
    ListQuestions
  }
});
