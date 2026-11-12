/*
 * Destek talebi ekleri.
 *
 * Dosyanın KENDİSİ veritabanında değil diskte (yükleme klasörünün "ekler"
 * alt klasöründe); burada yalnızca kaydı duruyor. Baytları tabloya koymak
 * yedekleri şişirir ve her liste sorgusunu ağırlaştırırdı.
 *
 * Ekler ürün görselleri gibi HERKESE AÇIK DEĞİL: ekran görüntüsü, fatura,
 * sipariş belgesi gibi kişisel içerik taşıyorlar. Bu yüzden "/yuklenen"
 * altından sunulmuyorlar; her indirme talebe erişim yetkisi sorulan bir
 * uçtan geçiyor.
 */
CREATE TABLE IF NOT EXISTS support_attachments (
  id            UUID PRIMARY KEY,
  -- Talep silinirse ekleri de gider; sahipsiz kayıt kalmaz.
  ticket_id     UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  -- Yükleyen silinse de ek talepte kalır: konuşmanın parçası.
  uploaded_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  -- Ekranda "Müşteri" mi "Mağaza/Destek" mi yazacağı.
  is_staff      BOOLEAN NOT NULL DEFAULT FALSE,
  /*
   * Diskteki ad: SUNUCUDA üretilir (rastgele 16 bayt + uzantı) ve kullanıcının
   * verdiği adla hiçbir ilgisi yoktur. Yol çıkışı (../) ve üzerine yazma bu
   * yüzden mümkün değil.
   */
  file_name     VARCHAR(64) NOT NULL UNIQUE,
  -- Kullanıcının gördüğü ad; yalnızca gösterilir ve indirmede önerilir,
  -- diskte hiçbir yerde kullanılmaz.
  original_name VARCHAR(160) NOT NULL,
  -- Tür içerikten (sihirli sayıdan) belirlenir, istemcinin beyanından değil.
  content_type  VARCHAR(100) NOT NULL,
  size_bytes    INTEGER NOT NULL CHECK (size_bytes > 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_attachments_ticket ON support_attachments (ticket_id, created_at);
