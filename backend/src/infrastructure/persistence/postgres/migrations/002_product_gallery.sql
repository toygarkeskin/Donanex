/*
 * Ürüne ek görseller.
 *
 * image_url OLDUĞU GİBİ KALIYOR ve kapak görseli olmayı sürdürüyor: ürün
 * kartları, sepet ve sipariş anlık görüntüsü onu kullanıyor. Yeni bir kapak
 * kavramı uydurmak yerine var olanı korumak, bu göçün hiçbir eski veriyi
 * taşımamasını sağlıyor — eski ürünler boş bir galeriyle çalışmaya devam eder.
 *
 * Ayrı bir product_images tablosu yerine dizi kolonu seçildi: galeri küçük
 * (en fazla 5), her zaman ürünle birlikte okunuyor, kendi başına
 * sorgulanmıyor ve sırası ürünün kendi alanı. Ayrı tablo burada yalnızca
 * her ürün okumasına bir JOIN eklerdi.
 *
 * NOT NULL DEFAULT '{}': galeri "yok" diye bir durum olmamalı, boş liste
 * olmalı. Böylece okuyan hiçbir kod null denetimi yapmak zorunda kalmıyor.
 */
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS gallery_urls VARCHAR(500)[] NOT NULL DEFAULT '{}';

/* Sayı sınırı veritabanında da duruyor: uygulamanın dışından (elle SQL,
   içe aktarma betiği) sınırsız görsel yazılmasın. */
ALTER TABLE products
  DROP CONSTRAINT IF EXISTS products_gallery_len;

ALTER TABLE products
  ADD CONSTRAINT products_gallery_len CHECK (cardinality(gallery_urls) <= 5);
