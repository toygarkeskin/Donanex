-- Başarısız test ödemesi / iptal durumunda stok iadesi için işaret.
-- Mevcut siparişler "iade edilmedi" (false) olarak başlar.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS stock_restored BOOLEAN NOT NULL DEFAULT FALSE;

-- Sık kullanılan sorgular için indeksler
CREATE INDEX IF NOT EXISTS idx_orders_customer_id   ON orders (customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at    ON orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_products_name        ON products (name);
CREATE INDEX IF NOT EXISTS idx_support_created_at   ON support_requests (created_at DESC);
