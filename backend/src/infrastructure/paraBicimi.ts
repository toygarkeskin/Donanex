"use strict";

/*
 * E-posta ve bildirim metinlerinde para: "80497.00 TL" değil "₺80.497,00".
 * Olaylar tutarı ondalık metin olarak taşıyor (Money.toDecimalString);
 * sayıya çevrilemezse metin olduğu gibi kalıyor — metin hiç bozulmasın.
 */
const TL = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" });

export function liraBicimi(tutar: unknown): string {
  const sayi = Number(tutar);
  return Number.isFinite(sayi) && String(tutar ?? "").trim() !== "" ? TL.format(sayi) : `${String(tutar ?? "")} TL`;
}
