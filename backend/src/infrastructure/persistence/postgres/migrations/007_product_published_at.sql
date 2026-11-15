/*
 * Ürünün VİTRİNE ÇIKTIĞI an.
 *
 * Ana sayfadaki "son gelenler" şeridi yeni ürünü göstermiyordu. Sebep:
 * sıralama "created_at" ile yapılıyordu ve ürün formu yeni ürünü TASLAK
 * olarak açıyor. Mağaza ürünü taslak kaydedip birkaç gün sonra yayına
 * aldığında, ürünün oluşturulma tarihi eski kalıyor ve şeridin gerisine
 * düşüyordu — kullanıcı gözüyle "yeni ekledim, görünmüyor".
 *
 * "Son gelen" demek "rafa son konan" demek; oluşturulma değil YAYINA ALINMA
 * anı. Bu yüzden ayrı bir sütun.
 */
ALTER TABLE products ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

/*
 * Neden tetikleyici (trigger), uygulama kodu değil:
 *
 * Bir ürün dört ayrı yoldan yayına girebiliyor: oluşturma, düzenleme,
 * durum değiştirme ve CSV ile toplu içe aktarma (bir de demo verisi).
 * Kuralı her birine ayrı ayrı yazmak, ileride eklenecek beşinci yolun onu
 * unutması demekti. Tetikleyici yazma yolundan bağımsız çalışıyor.
 *
 * Neden üretilmiş sütun değil (arama vektöründe olduğu gibi): üretilmiş
 * sütun satırın O ANKİ hâlinin bir işlevi, geçmişi hatırlayamıyor. Burada
 * aranan "İLK yayına girdiği an" — bir kez yazılıp korunması gereken bir
 * olay.
 *
 * YALNIZCA İLK SEFER: zaten dolu olan tarih değiştirilmiyor. Ürünü taslağa
 * alıp yeniden yayınlamak onu şeridin başına taşımamalı; yoksa her mağaza
 * ürünlerini kapatıp açarak ana sayfanın üstüne itebilirdi.
 */
CREATE OR REPLACE FUNCTION urun_yayin_tarihi() RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'active' AND NEW.published_at IS NULL THEN
    NEW.published_at := NOW();
  END IF;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_urun_yayin_tarihi ON products;
CREATE TRIGGER trg_urun_yayin_tarihi
  BEFORE INSERT OR UPDATE OF status ON products
  FOR EACH ROW EXECUTE FUNCTION urun_yayin_tarihi();

/* Mevcut yayındaki ürünler: en iyi tahmin oluşturulma anı. Bu UPDATE
   "status" sütununa dokunmadığı için tetikleyici çalışmıyor. */
UPDATE products SET published_at = created_at WHERE status = 'active' AND published_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_products_yayin ON products (status, published_at DESC);
