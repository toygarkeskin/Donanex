/*
 * Destek taleplerine öncelik ve tam metin arama.
 *
 * İki ayrı ihtiyaç ama aynı tabloya dokunuyorlar, bu yüzden tek göçte:
 *   - öncelik, sıraya hangi talebin önce gireceğini söyler
 *   - arama, talebi numarasını bilmeden bulmayı sağlar
 */

/* ------------------------------------------------------------------ öncelik

   Dört kademe. Daha fazlası ayırt edilemiyor: "yüksek" ile "çok yüksek"
   arasındaki farkı kimse tutarlı uygulamıyor ve sıralama anlamını yitiriyor.

   Varsayılan "normal" ve MÜŞTERİ BUNU SEÇEMİYOR. Talebi açan kişiye aciliyet
   sorulsaydı herkes "acil" derdi ve alan hiçbir şey söylemezdi; önceliği
   talebe bakan ekip veriyor. */
ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS priority VARCHAR(10) NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent'));

/*
 * Sıralama indeksi.
 *
 * Panelin varsayılan sırası "önce açık talepler, sonra öncelik, sonra en
 * yeni". Öncelik metin olduğu için alfabetik sırası yanlış (high < low <
 * normal < urgent); sıra CASE ile sayıya çevriliyor ve indeks de AYNI
 * ifadeyi taşıyor, yoksa sıralama her seferinde tabloyu tarardı.
 */
CREATE INDEX IF NOT EXISTS idx_tickets_oncelik
  ON support_tickets (
    (CASE status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END),
    (CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END),
    created_at DESC
  );

/* -------------------------------------------------------- tam metin arama

   Arama sütunu ÜRETİLMİŞ (generated): konu ve mesaj değiştiğinde kendiliğinden
   güncelleniyor. Tetikleyiciyle yapılsaydı, tetikleyiciyi atlayan tek bir
   toplu güncelleme indeksi sessizce eskitirdi.

   Dil "turkish": PostgreSQL'in Türkçe kök bulucusu kurulu geliyor ve işini
   yapıyor — "kargom gecikti" araması "kargo" ve "gecik" köklerine iniyor,
   yani "kargolar gecikiyor" yazan bir talebi de buluyor. 'simple' kullanılsaydı
   yalnızca birebir aynı kelime eşleşirdi.

   setweight ile konu (A) mesajdan (B) daha ağır: aynı kelime başlıkta
   geçiyorsa o talep üstte çıkıyor.

   Not: to_tsvector'ın İKİ argümanlı biçimi (dil sabit yazıldığında)
   IMMUTABLE'dır; üretilmiş sütun bunu şart koşuyor. Tek argümanlı biçim
   oturumun diline baktığı için kabul edilmezdi.
*/
ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS search_vector tsvector
    GENERATED ALWAYS AS (
      setweight(to_tsvector('turkish', COALESCE(subject, '')), 'A') ||
      setweight(to_tsvector('turkish', COALESCE(message, '')), 'B')
    ) STORED;

/* GIN: tam metin aramanın indeks türü. B-tree burada işe yaramaz, çünkü
   aranan şey sütunun TAMAMI değil içindeki tek tek kelimeler. */
CREATE INDEX IF NOT EXISTS idx_tickets_arama ON support_tickets USING GIN (search_vector);
