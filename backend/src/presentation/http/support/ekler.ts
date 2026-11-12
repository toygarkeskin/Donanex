"use strict";

import { raw, type Request, type Response } from "express";

/**
 * Talep eki uçlarının ortak parçaları.
 *
 * Yükleme multipart DEĞİL, ham gövde: tek dosya gönderiliyor ve ürün görseli
 * ucu da aynı biçimi kullanıyor. Dosyanın kendi adı gövdede taşınamadığı için
 * "X-Dosya-Adi" başlığında, URL kodlanmış olarak geliyor.
 */

/*
 * Gövde ayrıştırıcı. Sınır 6 MB: asıl sınır (5 MB) depolama katmanında,
 * baytlara bakılarak uygulanıyor; buradaki pay, kullanıcının nginx'in ya da
 * Express'in kuru "413" sayfası yerine anlaşılır Türkçe mesajı görmesi için.
 *
 * Tür listesi yalnızca KAPI: istemcinin "image/png" demesi yetmiyor, depolama
 * katmanı ilk baytlara bakıp gerçeği ayrıca doğruluyor.
 */
export const ekGovdesi = raw({
  type: ["image/png", "image/jpeg", "image/webp", "application/pdf"],
  limit: "6mb"
});

/** Gövde ham veri değilse (tür listede yoksa) anlaşılır bir 415 döner. */
export function ekGovdesiYoksa(req: Request, res: Response): boolean {
  if (Buffer.isBuffer(req.body) && req.body.length > 0) return false;
  res.status(415).json({
    error: "unsupported_media_type",
    message: "Ek PNG, JPEG, WebP ya da PDF olmalı ve ham veri olarak gönderilmeli."
  });
  return true;
}

/**
 * Başlıktaki dosya adı. Çözülemezse boş döner — ad zaten yalnızca gösterim
 * için; temizliği domain'deki displayFileName yapıyor.
 */
export function dosyaAdi(req: Request): string {
  const ham = req.get("X-Dosya-Adi") ?? "";
  try {
    return decodeURIComponent(ham);
  } catch {
    return "";
  }
}

/**
 * Eki indirme olarak gönderir.
 *
 * Başlıklar bilinçli:
 *  - "attachment": tarayıcı dosyayı bu sitenin bağlamında AÇMIYOR, indiriyor.
 *    İçinde betik saklanmış bir dosya olsa bile çalışacağı bir sayfa yok.
 *  - nosniff + sandbox CSP: tarayıcı içeriği başka bir türmüş gibi
 *    yorumlamaya kalkmasın.
 *  - "private, no-store": ekler kişisel; ara vekillerde ve paylaşılan
 *    önbelleklerde kalmasın.
 *  - Dosya adı RFC 5987 biçiminde (filename*): Türkçe karakterler
 *    ("Fatura_Şubat.pdf") bozulmadan ulaşıyor.
 */
export function ekiGonder(
  res: Response,
  { content, contentType, originalName }: { content: Buffer; contentType: string; originalName: string }
): void {
  const ascii = originalName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  res.set({
    "Content-Type": contentType,
    "Content-Length": String(content.length),
    "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(originalName)}`,
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "Cache-Control": "private, no-store"
  });
  res.send(content);
}
