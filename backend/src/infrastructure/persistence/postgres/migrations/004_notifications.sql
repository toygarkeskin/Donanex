/*
 * Bildirimler.
 *
 * Sistem zaten her önemli olay için e-posta gönderiyordu; bu tablo aynı
 * olayların site içinde de görünmesini sağlar. Kaynak İKİSİ İÇİN DE AYNI:
 * outbox'a yazılan domain olayı. Böylece "e-posta gitti ama zilde yok" ya da
 * tersi bir durum oluşmaz — iki tüketici aynı kuyruktan besleniyor.
 *
 * Bildirim METNİ burada tutulmaz üretilir: olay geldiğinde metne çevrilip
 * satır olarak yazılır. Alternatifi, olayı saklayıp her görüntülemede metne
 * çevirmekti; o zaman eski bir bildirimin metni bugünün koduna göre değişir
 * ve kullanıcı "bana bu yazmamıştı" der. Yazıldığı günün metni kalıcıdır.
 */

/*
 * Alıcı tek bir eksende tutuluyor: scope + scope_id.
 *
 *   user  → kişinin kendi bildirimi (scope_id = kullanıcı numarası)
 *   store → mağazanın bildirimi; o mağazanın paneline erişen herkes görür
 *   admin → yönetim panelinin bildirimi; kimseye bağlı değil (scope_id NULL)
 *
 * BEDELİ AÇIK: scope_id iki ayrı tabloyu gösterdiği için yabancı anahtar
 * konulamıyor, yani silinen bir kullanıcının bildirimi veritabanı tarafından
 * temizlenmiyor. Karşılığında tek indeks, tek sorgu biçimi ve yeni bir alıcı
 * türü eklemek için şema değişikliği gerekmemesi var. Bugün hiçbir akış
 * kullanıcıyı ya da mağazayı SİLMİYOR (sipariş kaydı korunsun diye ikisi de
 * durum alanıyla pasifleştiriliyor), bu yüzden eksik yabancı anahtar şu an
 * veri tutarlılığı sorunu üretmiyor. Üretecekse çözümü iki ayrı sütun değil,
 * silme akışının bildirimleri de temizlemesidir.
 */
CREATE TABLE IF NOT EXISTS notifications (
  id              UUID PRIMARY KEY,
  scope           VARCHAR(10) NOT NULL CHECK (scope IN ('user', 'store', 'admin')),
  scope_id        UUID,
  -- Olay tipi ("order.paid"): arayüz simgeyi ve rengi buna göre seçer.
  kind            VARCHAR(80) NOT NULL,
  title           VARCHAR(160) NOT NULL,
  body            VARCHAR(500) NOT NULL DEFAULT '',
  -- Tıklandığında gidilecek SİTE İÇİ yol ("/hesabim/siparisler/..."). Tam
  -- adres değil: aynı satır hem yerelde hem tünelde hem de alan adında doğru
  -- çalışsın diye ön ek istemcide eklenir.
  url             VARCHAR(300),
  source_event_id VARCHAR(40),
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- scope_id yalnızca ve tam olarak admin bildirimlerinde boştur.
  CONSTRAINT notifications_kapsam_tutarli CHECK ((scope = 'admin') = (scope_id IS NULL))
);

/*
 * Aynı olayın iki kez bildirime dönmesini engeller.
 *
 * Kuyruk EN AZ BİR KEZ teslim garantisi verir: tüketici mesajı işledikten
 * sonra onay gönderemezse (süreç kapandı, bağlantı düştü) mesaj yeniden
 * gelir. Dedupe olmasa kullanıcı aynı "kargoya verildi" bildirimini iki kez
 * görürdü. Yazma tarafı ON CONFLICT DO NOTHING ile geçiyor.
 *
 * NULLS NOT DISTINCT gerekli: admin bildirimlerinde scope_id NULL ve
 * PostgreSQL varsayılan olarak iki NULL'u farklı sayar — o kuralla admin
 * bildirimleri hiç tekilleşmezdi. (PostgreSQL 15+)
 *
 * Kısmi indeks: elle oluşturulan bildirimlerin kaynak olayı yoktur, onlar
 * tekillik kuralının dışında kalır.
 */
CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_olay
  ON notifications (source_event_id, scope, scope_id) NULLS NOT DISTINCT
  WHERE source_event_id IS NOT NULL;

/* Listeleme: alıcının bildirimleri, en yenisi başta. */
CREATE INDEX IF NOT EXISTS idx_notifications_kapsam
  ON notifications (scope, scope_id, created_at DESC);

/*
 * Okunmamış sayacı zilin yanında her sayfada duruyor, yani en sık çalışan
 * sorgu bu. Kısmi indeks yalnızca okunmamışları tutar: okunmuş bildirimler
 * zamanla biriktikçe indeks büyümez.
 */
CREATE INDEX IF NOT EXISTS idx_notifications_okunmamis
  ON notifications (scope, scope_id)
  WHERE read_at IS NULL;
