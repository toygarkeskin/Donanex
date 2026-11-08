/**
 * Sayfa başlığı ve meta açıklaması.
 *
 * Her sayfanın başlığı "Donanex" idi; sekmelerde, yer imlerinde, tarayıcı
 * geçmişinde ve arama sonuçlarında hepsi aynı görünüyordu. Burası başlığı
 * ve açıklamayı gezinme sırasında güncelliyor.
 *
 * SINIR: Bu uygulama bir SPA, yani etiketler sunucudan hazır gelmiyor,
 * tarayıcıda JavaScript ile yazılıyor. Google sayfayı çalıştırıp okuyabilir,
 * ama sosyal medya önizlemeleri (WhatsApp, X, LinkedIn) JavaScript
 * çalıştırmaz — onlar yalnızca index.html'deki SABİT etiketleri görür.
 * Yani paylaşım önizlemesi her bağlantıda aynı kalır; sayfa başına farklı
 * önizleme istenirse sunucu tarafı render gerekir.
 */

const SITE_ADI = "Donanex";

/** Başlık verilmeyen sayfalarda kullanılan tanıtım cümlesi. */
const VARSAYILAN_ACIKLAMA =
  "Donanex — çok satıcılı teknoloji mağazası. Binlerce ürün, onlarca mağaza.";

/**
 * Sekme başlığını yazar.
 *
 * Boş geçilirse yalnızca site adı kalır; "undefined — Donanex" gibi bir
 * başlık görünmesin diye değer temizlenip denetleniyor.
 */
export function basligiAyarla(baslik) {
  const temiz = typeof baslik === "string" ? baslik.trim() : "";
  document.title = temiz ? `${temiz} — ${SITE_ADI}` : SITE_ADI;
}

/** Meta açıklamasını yazar; etiket yoksa oluşturur. */
export function aciklamayiAyarla(aciklama) {
  const temiz = typeof aciklama === "string" && aciklama.trim() ? aciklama.trim() : VARSAYILAN_ACIKLAMA;
  let etiket = document.querySelector('meta[name="description"]');
  if (!etiket) {
    etiket = document.createElement("meta");
    etiket.setAttribute("name", "description");
    document.head.appendChild(etiket);
  }
  // Açıklama uzunsa arama sonucunda kırpılır; 160 karakter yaygın sınır.
  etiket.setAttribute("content", temiz.slice(0, 160));
}

/** Başlık ve açıklamayı birlikte yazar. */
export function sayfayiTanimla(baslik, aciklama) {
  basligiAyarla(baslik);
  aciklamayiAyarla(aciklama);
}
