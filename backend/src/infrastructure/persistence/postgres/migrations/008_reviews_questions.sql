/*
 * Ürün yorumları (fotoğraflı) ve ürün soru-cevapları.
 *
 * İkisi de herkese açık okunur, yalnızca giriş yapmış kullanıcı yazar.
 */

/* --------------------------------------------------------------- yorumlar */
CREATE TABLE IF NOT EXISTS product_reviews (
  id                 UUID PRIMARY KEY,
  product_id         UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  -- Kullanıcı silinse de yorum kalır; ad zaten aşağıda kopyalandı.
  user_id            UUID REFERENCES users(id) ON DELETE SET NULL,
  /*
   * Ekranda görünen ad YAZILDIĞI ANDA kopyalanıyor ve KISALTILIYOR
   * ("Ayşe Yılmaz" -> "Ayşe Y."). Herkese açık bir sayfada tam ad
   * gösterilmiyor; kopya ise kullanıcı adını değiştirse de geçmiş yorumun
   * "kimin yazdığı" bilgisinin değişmemesi için.
   */
  author_name        VARCHAR(80) NOT NULL,
  rating             SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body               VARCHAR(2000) NOT NULL,
  /*
   * "Satın aldı" rozeti. Yorum yazmak satın almayı ŞART KOŞMUYOR (ürünü
   * mağazada görmüş, hediye almış olabilir) ama satın alanın yorumu ayrıca
   * işaretleniyor — okuyanın en çok güvendiği bilgi bu.
   */
  verified_purchase  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Kişi başına ürün başına TEK yorum: ikinci gönderim mevcut olanı günceller.
  CONSTRAINT uq_review_user UNIQUE (product_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_reviews_product ON product_reviews (product_id, created_at DESC);

/*
 * Yorum fotoğrafları HERKESE AÇIK (ürün görselleri gibi /yuklenen altından):
 * yorum zaten herkese açık bir sayfada. Destek eklerinden farkı bu —
 * onlar kişisel olduğu için yetkiyle sunuluyor.
 */
CREATE TABLE IF NOT EXISTS product_review_photos (
  id           UUID PRIMARY KEY,
  review_id    UUID NOT NULL REFERENCES product_reviews(id) ON DELETE CASCADE,
  image_url    VARCHAR(200) NOT NULL UNIQUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_review_photos_review ON product_review_photos (review_id, created_at);

/* ------------------------------------------------------------ soru-cevap */
CREATE TABLE IF NOT EXISTS product_questions (
  id           UUID PRIMARY KEY,
  product_id   UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  author_name  VARCHAR(80) NOT NULL,
  body         VARCHAR(1000) NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_questions_product ON product_questions (product_id, created_at DESC);

/*
 * Yanıtı SATICI veriyor (ürünün mağazasında talep yanıtlama izni olan) ya
 * da yönetim. Müşterilerin birbirine yanıt vermesi bilinçli olarak yok:
 * "ürün şunu destekliyor mu" sorusuna yanlış bir müşteri yanıtı, satıcının
 * sorumluluğunda olmayan bir söz olarak sayfada kalırdı.
 */
CREATE TABLE IF NOT EXISTS product_answers (
  id           UUID PRIMARY KEY,
  question_id  UUID NOT NULL REFERENCES product_questions(id) ON DELETE CASCADE,
  user_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  -- Satıcı yanıtında mağazanın adı görünüyor, kişinin adı değil.
  author_name  VARCHAR(150) NOT NULL,
  body         VARCHAR(1000) NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_answers_question ON product_answers (question_id, created_at);
