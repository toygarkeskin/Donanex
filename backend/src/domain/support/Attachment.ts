"use strict";

/**
 * Destek talebi eki kuralları.
 *
 * Tür ve boyut denetiminin ASIL yeri depolama katmanıdır: dosyanın gerçekte
 * ne olduğunu baytlar söyler. Buradaki sınırlar ise iş kuralı — kaç ek, hangi
 * durumda — ve her iki taraf aynı sayıları buradan okur.
 */

/** Tek bir ekin üst sınırı. Telefon ekran görüntüsü ve taranmış fatura için bol. */
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

/**
 * Bir talepteki en fazla ek sayısı.
 *
 * Sınır var, çünkü ek yükleme ucu giriş yapmış her müşteriye açık: sınırsız
 * olsaydı tek bir talep diski doldurmanın yolu olurdu.
 */
export const MAX_ATTACHMENTS_PER_TICKET = 5;

/** Kabul edilen türler; arayüz "accept" listesini ve açıklamasını buradan kurar. */
export const ATTACHMENT_TYPES = Object.freeze(["image/png", "image/jpeg", "image/webp", "application/pdf"]);

/**
 * Kullanıcının verdiği dosya adını GÖSTERİLEBİLİR hâle getirir.
 *
 * Bu ad diskte HİÇBİR YERDE kullanılmıyor (diskteki ad sunucuda üretilir);
 * yalnızca ekranda ve indirmede öneri olarak görünüyor. Yine de temizleniyor:
 *  - yol parçaları atılır ("C:\\Users\\…\\fatura.pdf" -> "fatura.pdf"),
 *  - kontrol karakterleri atılır (başlıklara satır sonu sızmasın),
 *  - uzunluk sınırlanır,
 *  - geriye bir şey kalmazsa "ek" denir.
 */
export function displayFileName(value: unknown): string {
  const ham = typeof value === "string" ? value : "";
  const son = ham.split(/[\\/]/).pop() ?? "";
  // eslint-disable-next-line no-control-regex
  const temiz = son.replace(/[\u0000-\u001f\u007f"]/g, "").trim();
  return (temiz || "ek").slice(0, 120);
}
