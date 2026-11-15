"use strict";

/**
 * Hangi ürün hangi ürünü TAMAMLAR.
 *
 * Sepette mouse olan birine "bir mouse daha al" demek öneri değil, gürültü.
 * Mantıklı öneri, aldığı şeyle BİRLİKTE kullanılan şey: mouse alana klavye,
 * mousepad, kulaklık; ekran kartı alana monitör ve işlemci.
 *
 * Kural kısa adlarla (slug) yazılıyor ve SIRA önemli: listede önce gelen,
 * öneride de önce geliyor. Haritada olmayan bir kategori (mağazanın yeni
 * eklediği bir kategori) için tamamlayıcı yok; o durumda öneri yine
 * çalışıyor, yalnızca "kendi kategorisi dışındaki en yeni ürünler"e düşüyor.
 *
 * Neden veritabanında değil de kodda: bu bir ürün kararı (ne neyle satılır)
 * ve sayısı az; ayrı bir tablo ve yönetim ekranı, hiç değişmeyecek bir
 * listeye bakım yükü olurdu. Kategoriler çoğaldıkça buraya satır eklemek
 * yeterli.
 */
const TAMAMLAYICILAR: Readonly<Record<string, readonly string[]>> = Object.freeze({
  mouse: ["mousepad", "klavye", "kulaklik", "monitor"],
  klavye: ["mouse", "mousepad", "kulaklik", "monitor"],
  mousepad: ["mouse", "klavye"],
  kulaklik: ["mouse", "klavye", "oyun-kumandasi"],
  monitor: ["ekran-karti", "klavye", "mouse"],
  laptop: ["mouse", "kulaklik", "depolama", "klavye"],
  "ekran-karti": ["monitor", "islemci", "ram", "depolama"],
  islemci: ["ram", "ekran-karti", "depolama"],
  ram: ["islemci", "ekran-karti", "depolama"],
  depolama: ["laptop", "ram", "islemci"],
  "oyun-kumandasi": ["kulaklik", "monitor"]
});

/**
 * Verilen kategorilerin tamamlayıcıları, öncelik sırasıyla ve tekrarsız.
 *
 * Sepetteki kategorilerin KENDİSİ sonuçtan çıkarılıyor: mouse ve klavye
 * birlikte sepetteyse, mouse'un tamamlayıcısı olan klavye yeniden
 * önerilmiyor.
 */
export function complementsFor(categorySlugs: readonly string[]): string[] {
  const kendi = new Set(categorySlugs);
  const sonuc: string[] = [];
  // Kategoriler sırayla taranıyor ama her birinin İLK önerisi önce gelsin
  // diye "tur tur" ilerleniyor: mouse+monitör sepetinde önce mousepad ve
  // ekran kartı, sonra ikinci sıradakiler.
  const listeler = categorySlugs.map((slug) => TAMAMLAYICILAR[slug] ?? []);
  const enUzun = Math.max(0, ...listeler.map((liste) => liste.length));
  for (let i = 0; i < enUzun; i += 1) {
    for (const liste of listeler) {
      const aday = liste[i];
      if (aday && !kendi.has(aday) && !sonuc.includes(aday)) sonuc.push(aday);
    }
  }
  return sonuc;
}
