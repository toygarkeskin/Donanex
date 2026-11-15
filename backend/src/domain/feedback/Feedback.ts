"use strict";

import { ValidationError } from "../shared/errors";
import { requireText } from "../shared/guards";

/** Bir yoruma en fazla kaç fotoğraf eklenebilir. */
export const MAX_REVIEW_PHOTOS = 3;

export interface ReviewInput {
  rating?: unknown;
  body?: unknown;
}

export interface Review {
  readonly rating: number;
  readonly body: string;
}

/**
 * Yorum. Puan 1-5 arası TAM SAYI; metin en az 10 karakter.
 *
 * Alt sınır var, çünkü "güzel" tek kelimesi okuyana bilgi vermiyor ama
 * ortalamaya yine de giriyor. 10 karakter, "Çok memnun kaldım." diyebilmeye
 * yetiyor.
 */
export function createReview(input?: ReviewInput | null): Review {
  const data = input ?? {};
  const rating = typeof data.rating === "string" ? Number(data.rating) : data.rating;
  if (!Number.isInteger(rating) || (rating as number) < 1 || (rating as number) > 5) {
    throw new ValidationError("Puan 1 ile 5 arasında olmalı.");
  }
  const body = requireText(data.body, "Yorum", 2000);
  if (body.trim().length < 10) throw new ValidationError("Yorum en az 10 karakter olmalı.");
  return Object.freeze({ rating: rating as number, body: body.trim() });
}

export function createQuestionBody(value: unknown): string {
  const body = requireText(value, "Soru", 1000).trim();
  if (body.length < 5) throw new ValidationError("Soru en az 5 karakter olmalı.");
  return body;
}

export function createAnswerBody(value: unknown): string {
  const body = requireText(value, "Yanıt", 1000).trim();
  if (body.length < 2) throw new ValidationError("Yanıt boş olamaz.");
  return body;
}

/**
 * Herkese açık sayfada görünecek ad: ad + soyadın baş harfi.
 *
 * "Ayşe Yılmaz" -> "Ayşe Y.", "Mehmet Ali Kaya" -> "Mehmet Ali K.". Tam ad
 * herkese açık bir ürün sayfasında gösterilmiyor; yorumun bir gerçek kişiye
 * ait olduğu yine anlaşılıyor.
 */
export function publicDisplayName(fullName: unknown): string {
  const parcalar = String(fullName ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parcalar.length) return "Müşteri";
  if (parcalar.length === 1) return parcalar[0].slice(0, 60);
  const soyad = parcalar[parcalar.length - 1];
  return `${parcalar.slice(0, -1).join(" ")} ${soyad[0].toLocaleUpperCase("tr-TR")}.`.slice(0, 60);
}
