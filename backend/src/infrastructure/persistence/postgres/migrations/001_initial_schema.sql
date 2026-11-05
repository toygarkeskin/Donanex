-- İlk şema. Eski server.js'in açılışta oluşturduğu tablolarla birebir uyumludur;
-- mevcut bir veritabanında çalıştırıldığında hiçbir veriyi silmez.

CREATE TABLE IF NOT EXISTS products (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(250) NOT NULL,
  description TEXT NOT NULL,
  price       NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
  image       VARCHAR(500) NOT NULL,
  category    VARCHAR(100) NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0);

CREATE TABLE IF NOT EXISTS customers (
  id            BIGSERIAL PRIMARY KEY,
  name          VARCHAR(150) NOT NULL,
  email         VARCHAR(254) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS address_full_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS phone VARCHAR(30),
  ADD COLUMN IF NOT EXISTS address VARCHAR(1000);

CREATE TABLE IF NOT EXISTS orders (
  id            BIGSERIAL PRIMARY KEY,
  customer_name VARCHAR(150) NOT NULL,
  email         VARCHAR(254) NOT NULL,
  phone         VARCHAR(30) NOT NULL,
  address       VARCHAR(1000) NOT NULL,
  total         NUMERIC(12, 2) NOT NULL CHECK (total >= 0),
  status        VARCHAR(50) NOT NULL DEFAULT 'Ödeme bekleniyor',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS customer_id BIGINT REFERENCES customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS shipping_company VARCHAR(100),
  ADD COLUMN IF NOT EXISTS tracking_number VARCHAR(100),
  ADD COLUMN IF NOT EXISTS tracking_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS tracking_code_hash VARCHAR(64);

CREATE TABLE IF NOT EXISTS order_items (
  id           BIGSERIAL PRIMARY KEY,
  order_id     BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id   INTEGER NOT NULL REFERENCES products(id),
  product_name VARCHAR(250) NOT NULL,
  quantity     INTEGER NOT NULL CHECK (quantity > 0),
  unit_price   NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0)
);

CREATE TABLE IF NOT EXISTS support_requests (
  id             BIGSERIAL PRIMARY KEY,
  full_name      VARCHAR(200) NOT NULL,
  email          VARCHAR(254) NOT NULL,
  phone          VARCHAR(40) NOT NULL DEFAULT '',
  message        TEXT NOT NULL,
  status         VARCHAR(30) NOT NULL DEFAULT 'Yeni',
  admin_response TEXT NOT NULL DEFAULT '',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
