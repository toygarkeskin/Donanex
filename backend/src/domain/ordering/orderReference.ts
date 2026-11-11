"use strict";

import { ValidationError } from "../shared/errors";
import { isUuid } from "../shared/guards";

/**
 * Siparişe iki yoldan erişilebilir: iç kimliğiyle (UUID) ya da müşteriye
 * gösterilen sipariş numarasıyla (PZ-2026-001005).
 *
 * Neden ikisi birden: adres çubuğunda UUID okunmuyor ve paylaşılamıyor —
 * "/hesabim/siparisler/PZ-2026-001005" hem anlaşılır hem telefonda okunup
 * yazılabilir. Ama eski bağlantılar, e-postalar ve bildirimler UUID taşıyor;
 * onları kırmamak için iki biçim de kabul ediliyor ve arayüz adresi
 * yükledikten sonra okunur olanla değiştiriyor.
 *
 * İkisi AYNI alanda taşınmıyor: hangi sütunla eşleşeceği SQL'e açıkça
 * iletiliyor. Tek alanda taşınıp "önce UUID gibi dene" yapılsaydı, numara
 * biçimindeki bir metni uuid'ye çevirme denemesi veritabanı hatası
 * fırlatırdı.
 */
export interface OrderRef {
  readonly id: string | null;
  readonly number: string | null;
}

/*
 * Sipariş numarası biçimi: PZ-<yıl>-<6 hane>.
 *
 * Desen burada DAR tutuluyor. Serbest metni numara sayıp veritabanına
 * göndermek, adres çubuğuna yazılan her şeyin sorguya dönmesi demekti;
 * dar desen o kapıyı kapatıyor ve hatayı sorgudan önce veriyor.
 */
const SIPARIS_NUMARASI = /^PZ-\d{4}-\d{6}$/;

/** Sipariş numarasının adres çubuğunda ve ekranda görünen tek doğru hâli. */
export const normalizeOrderNumber = (value: string): string => value.trim().toUpperCase();

export const isOrderNumber = (value: unknown): value is string =>
  typeof value === "string" && SIPARIS_NUMARASI.test(normalizeOrderNumber(value));

/**
 * Adresten gelen değeri referansa çevirir; ikisinden biri değilse hata.
 *
 * Küçük harfle yazılmış numara ("pz-2026-001005") kabul edilip büyük harfe
 * çevriliyor: kullanıcı adresi elle yazdığında büyük/küçük harf yüzünden
 * "bulunamadı" görmesin.
 */
export function orderReference(value: unknown, field = "Sipariş numarası"): OrderRef {
  if (isUuid(value)) return { id: value, number: null };
  if (isOrderNumber(value)) return { id: null, number: normalizeOrderNumber(value as string) };
  throw new ValidationError(`${field} geçersiz.`);
}
