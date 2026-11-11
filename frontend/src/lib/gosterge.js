/**
 * Gösterge paneli yardımcıları.
 *
 * Sunucu on dört günlük seriyi `[{ date, orders, revenueCents }]` olarak
 * veriyor. Eğilim (son 7 gün / önceki 7 gün) AYRI BİR SORGU DEĞİL, aynı
 * serinin içinden hesaplanıyor: veri zaten elde, ikinci bir sorgu açmak
 * aynı şeyi iki kez sormak olurdu.
 */

/** Grafiğin beklediği şekle çevirir: [{ date, deger }]. */
export function seri(gunler, olcut) {
  return (gunler ?? []).map((gun) => ({
    date: gun.date,
    // revenueCents veritabanından BIGINT geliyor ve sürücü onu metin olarak
    // veriyor (büyük sayıda duyarlık kaybolmasın diye). Number() şart:
    // metinle toplama yapmak birleştirme üretirdi ("100" + "200" = "100200").
    deger: Number(olcut === "revenue" ? gun.revenueCents : gun.orders) || 0
  }));
}

const topla = (gunler, olcut) => seri(gunler, olcut).reduce((toplam, gun) => toplam + gun.deger, 0);

/**
 * Son 7 günün önceki 7 güne göre yüzde değişimi.
 *
 * Önceki hafta SIFIRSA null dönüyor, "%100 artış" değil: sıfırdan artışın
 * yüzdesi tanımsızdır ve "sonsuz büyüme" gibi okunan bir rozet, yeni açılmış
 * her mağazanın panelinde yanıltıcı biçimde parlardı. null gelince kart
 * eğilim rozetini hiç çizmiyor.
 */
export function egilim(gunler, olcut) {
  const liste = gunler ?? [];
  if (liste.length < 14) return null;

  const onceki = topla(liste.slice(0, 7), olcut);
  const son = topla(liste.slice(7), olcut);
  if (onceki === 0) return null;

  return ((son - onceki) / onceki) * 100;
}

/** Son 7 günün toplamı; kartlarda "bu hafta" değeri olarak kullanılıyor. */
export const sonHafta = (gunler, olcut) => topla((gunler ?? []).slice(7), olcut);
