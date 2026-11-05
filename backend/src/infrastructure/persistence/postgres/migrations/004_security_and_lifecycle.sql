-- Geçmiş siparişlerde geçen ürünler silinmez, satıştan kaldırılır.
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- Parola değişince tüm eski oturum belirteçleri geçersiz olur.
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 1;

-- Tek kullanımlık parola sıfırlama belirteçleri (yalnızca özetleri saklanır).
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token_hash  VARCHAR(64) PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reset_tokens_customer ON password_reset_tokens (customer_id);

-- Çıkış yapılmış oturum belirteçleri (süreleri dolunca temizlenir).
CREATE TABLE IF NOT EXISTS revoked_sessions (
  jti        UUID PRIMARY KEY,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_revoked_sessions_expires ON revoked_sessions (expires_at);

-- Süresi dolan ödenmemiş siparişleri bulmak ve yönetici filtreleri için.
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders (status, created_at);
CREATE INDEX IF NOT EXISTS idx_products_active_category ON products (is_active, category);
