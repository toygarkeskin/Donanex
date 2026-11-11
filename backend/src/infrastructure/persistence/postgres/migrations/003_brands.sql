/*
 * Markalar.
 *
 * Marka, MAĞAZADAN AYRI bir eksendir: "Teknoloji Deposu" bir satıcıdır,
 * "MSI" ise ürünün üreticisidir. Aynı markayı birden çok mağaza satabilir,
 * aynı mağaza birden çok marka satar. Bu yüzden mağaza alanına sıkıştırmak
 * ya da ürün adından her seferinde ayıklamaya çalışmak yerine kendi tablosu
 * var.
 *
 * verified: pazar yerinin markanın resmî sayfası olduğunu onayladığı anlamına
 * gelir. Şu an bunu hiçbir akış DOĞRU yapmıyor, bu yüzden varsayılan FALSE ve
 * arayüz rozeti yalnızca true olduğunda çiziliyor — olmayan bir denetimi
 * varmış gibi göstermemek için.
 */
CREATE TABLE IF NOT EXISTS brands (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        VARCHAR(120) NOT NULL UNIQUE,
  name        VARCHAR(120) NOT NULL,
  description VARCHAR(2000) NOT NULL DEFAULT '',
  logo_url    VARCHAR(500),
  verified    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

/* Ürün silinmez, markası boşalır: marka kaydı kaldırılsa bile katalog durur. */
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES brands(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_products_brand ON products (brand_id);

/* ------------------------------------------------------------ marka kayıtları

   Açıklamalar firmanın ne ürettiğini anlatır; fiyat, kalite ya da "en iyi"
   gibi bir iddia taşımaz — bunlar doğrulanamaz. */
INSERT INTO brands (slug, name, description) VALUES
  ('amd',             'AMD',              'İşlemci ve ekran kartı üreticisi. Ryzen işlemcileri ve Radeon ekran kartlarıyla bilinir.'),
  ('intel',           'Intel',            'Bilgisayar işlemcisi üreticisi. Core serisi masaüstü ve dizüstü işlemcileriyle bilinir.'),
  ('msi',             'MSI',              'Tayvan merkezli donanım üreticisi. Ekran kartı, anakart ve oyuncu dizüstü bilgisayarları üretir.'),
  ('asus',            'ASUS',             'Tayvan merkezli bilgisayar üreticisi. TUF ve ROG serileriyle oyuncu donanımında bilinir.'),
  ('gigabyte',        'GIGABYTE',         'Anakart, ekran kartı ve dizüstü bilgisayar üreten Tayvan merkezli donanım firması.'),
  ('logitech',        'Logitech',         'İsviçre merkezli çevre birimi üreticisi. Mouse, klavye ve ses ürünleri yapar; oyuncu serisi Logitech G adıyla satılır.'),
  ('razer',           'Razer',            'Oyuncu donanımı üreticisi. Mouse, klavye ve kulaklıklarıyla bilinir.'),
  ('steelseries',     'SteelSeries',      'Danimarka merkezli oyuncu donanımı üreticisi. Arctis kulaklık serisiyle bilinir.'),
  ('hyperx',          'HyperX',           'Oyuncu kulaklığı, klavyesi ve mouse''u üreten donanım markası.'),
  ('keychron',        'Keychron',         'Mekanik klavye üreticisi. Kablosuz ve hot-swap destekli modelleriyle bilinir.'),
  ('samsung',         'Samsung',          'Güney Kore merkezli elektronik üreticisi. SSD ve monitör ürünleri katalogda yer alır.'),
  ('western-digital', 'Western Digital',  'Depolama üreticisi. SSD ve sabit disk ürünleriyle bilinir.'),
  ('lg',              'LG',               'Güney Kore merkezli elektronik üreticisi. UltraGear oyuncu monitörleriyle bilinir.'),
  ('hp',              'HP',               'Bilgisayar ve yazıcı üreticisi. ProBook serisi iş dizüstü bilgisayarları katalogda yer alır.'),
  ('microsoft',       'Microsoft',        'Yazılım ve donanım üreticisi. Xbox oyun kumandaları katalogda yer alır.'),
  ('a4tech',          'A4Tech',           'Çevre birimi üreticisi. Bloody serisi oyuncu mouse''larıyla bilinir.'),
  ('8bitdo',          '8BitDo',           'Oyun kumandası üreticisi. Retro tasarımlı kablosuz kumandalarıyla bilinir.'),
  ('excalibur',       'Excalibur',        'Casper''ın oyuncu donanımı markası.')
ON CONFLICT (slug) DO NOTHING;

/* --------------------------------------------------- ürünleri markaya bağla

   Eşleştirme ürün adının BAŞINDAKİ markaya bakar. "Ortada geçiyorsa" kuralı
   kurulsaydı "ASUS TUF" araması "TUF" içeren başka marka ürünlerini de
   yakalardı. Takma adlar (WD, Xbox) ayrıca yazıldı. */
WITH eslestirme(slug, onek) AS (VALUES
  ('amd', 'AMD %'), ('intel', 'Intel %'),
  ('msi', 'MSI %'), ('asus', 'ASUS %'),
  ('gigabyte', 'GIGABYTE %'), ('logitech', 'Logitech %'),
  ('razer', 'Razer %'), ('steelseries', 'SteelSeries %'),
  ('hyperx', 'HyperX %'), ('keychron', 'Keychron %'),
  ('samsung', 'Samsung %'), ('western-digital', 'Western Digital %'),
  ('western-digital', 'WD %'), ('lg', 'LG %'),
  ('hp', 'HP %'), ('microsoft', 'Xbox %'),
  ('a4tech', 'A4Tech %'), ('8bitdo', '8BitDo %'),
  ('excalibur', 'Excalibur %')
)
UPDATE products p
   SET brand_id = b.id
  FROM eslestirme e
  JOIN brands b ON b.slug = e.slug
 WHERE p.brand_id IS NULL
   AND p.name ILIKE e.onek;
