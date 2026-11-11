/*
 * Donanex service worker.
 *
 * Kasıtlı olarak KÜÇÜK. Bir alışveriş sitesinde agresif önbellek, kullanıcıya
 * eski fiyat ve tükenmiş stok göstermek demektir; "çevrimdışı çalışsın" diye
 * yazılan bir service worker en çok burada zarar verir.
 *
 * Bu yüzden kural şu: AĞ ÖNCE. Yalnızca gezinme istekleri (adres çubuğuna
 * yazılan ya da tıklanan sayfalar) ağa ulaşamadığında, "bağlantı yok"
 * diyen bir sayfa gösteriliyor. API yanıtları, görseller ve veri HİÇ
 * önbelleklenmiyor.
 *
 * Service worker'ın ikinci işi uygulamayı KURULABİLİR yapmak: tarayıcı,
 * fetch olayını dinleyen bir service worker olmadan "ana ekrana ekle"
 * önermiyor.
 */

const SURUM = "donanex-v1";
const CEVRIMDISI = "/cevrimdisi.html";

self.addEventListener("install", (olay) => {
  olay.waitUntil(caches.open(SURUM).then((kutu) => kutu.add(CEVRIMDISI)));
  // Yeni sürüm beklemeden devralsın: eski bir service worker'ın elinde
  // kalmış sekme, günlerce eski davranışı sürdürebiliyor.
  self.skipWaiting();
});

self.addEventListener("activate", (olay) => {
  olay.waitUntil(
    caches
      .keys()
      .then((adlar) => Promise.all(adlar.filter((ad) => ad !== SURUM).map((ad) => caches.delete(ad))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (olay) => {
  const istek = olay.request;

  // Yalnızca sayfa gezinmeleri. GET olmayan her şey (sipariş, sepet, giriş)
  // ve API çağrıları olduğu gibi ağa gider.
  if (istek.mode !== "navigate") return;

  olay.respondWith(fetch(istek).catch(() => caches.match(CEVRIMDISI)));
});
