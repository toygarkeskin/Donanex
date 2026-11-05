-- Pazar — ilk şema.
--
-- Kurallar:
--  * Para her zaman BIGINT kuruş olarak saklanır; NUMERIC yuvarlama sürprizi olmaz.
--  * Silme davranışı bilinçlidir: kullanıcı silinince siparişi kalır (SET NULL),
--    mağaza silinince ürünleri gider (CASCADE), siparişte geçen ürün silinemez (RESTRICT).
--  * E-posta her zaman küçük harfe çevrilerek yazılır; benzersizliği indeks sağlar.

/* ---------------------------------------------------------------- kimlik */

CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY,
  email           VARCHAR(254) NOT NULL,
  email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
  password_hash   TEXT NOT NULL,
  full_name       VARCHAR(150) NOT NULL,
  phone           VARCHAR(30),
  status          VARCHAR(20) NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'suspended')),
  -- Parola değişince artar; eski erişim jetonları böylece geçersiz olur.
  session_version INTEGER NOT NULL DEFAULT 1,
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email ON users (lower(email));

CREATE TABLE IF NOT EXISTS user_addresses (
  id          UUID PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       VARCHAR(60) NOT NULL,
  full_name   VARCHAR(150) NOT NULL,
  phone       VARCHAR(30) NOT NULL,
  city        VARCHAR(80) NOT NULL,
  district    VARCHAR(80) NOT NULL,
  line        VARCHAR(500) NOT NULL,
  postal_code VARCHAR(20),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_addresses_user ON user_addresses (user_id);

/* ------------------------------------------------- roller ve izinler */

CREATE TABLE IF NOT EXISTS permissions (
  code        VARCHAR(80) PRIMARY KEY,
  label       VARCHAR(200) NOT NULL,
  scope       VARCHAR(10) NOT NULL CHECK (scope IN ('global', 'store', 'both'))
);

CREATE TABLE IF NOT EXISTS roles (
  code        VARCHAR(40) PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  description VARCHAR(300) NOT NULL DEFAULT '',
  scope       VARCHAR(10) NOT NULL CHECK (scope IN ('global', 'store')),
  is_system   BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_code       VARCHAR(40) NOT NULL REFERENCES roles(code) ON DELETE CASCADE,
  permission_code VARCHAR(80) NOT NULL REFERENCES permissions(code) ON DELETE CASCADE,
  PRIMARY KEY (role_code, permission_code)
);

/* ------------------------------------------------------------- mağazalar */

CREATE TABLE IF NOT EXISTS stores (
  id            UUID PRIMARY KEY,
  slug          VARCHAR(120) NOT NULL UNIQUE,
  name          VARCHAR(120) NOT NULL,
  description   VARCHAR(2000) NOT NULL,
  contact_email VARCHAR(254) NOT NULL,
  phone         VARCHAR(30) NOT NULL,
  tax_number    VARCHAR(30),
  logo_url      VARCHAR(500),
  status        VARCHAR(20) NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'active', 'suspended')),
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_stores_owner ON stores (owner_user_id);
CREATE INDEX IF NOT EXISTS idx_stores_status ON stores (status);

-- Rol ataması: store_id NULL ise sistem geneli, doluysa o mağazaya bağlı.
CREATE TABLE IF NOT EXISTS user_roles (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_code  VARCHAR(40) NOT NULL REFERENCES roles(code) ON DELETE CASCADE,
  store_id   UUID REFERENCES stores(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- NULL = NULL olmadığı için COALESCE ile benzersizlik sağlanır.
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_roles
  ON user_roles (user_id, role_code, COALESCE(store_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles (user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_store ON user_roles (store_id);

/* ------------------------------------------------------- oturum ve OAuth */

CREATE TABLE IF NOT EXISTS auth_sessions (
  id         UUID PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  ip         VARCHAR(45),
  user_agent VARCHAR(300),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires ON auth_sessions (expires_at);

CREATE TABLE IF NOT EXISTS oauth_clients (
  client_id       VARCHAR(80) PRIMARY KEY,
  name            VARCHAR(120) NOT NULL,
  secret_hash     TEXT,
  redirect_uris   TEXT[] NOT NULL DEFAULT '{}',
  grant_types     TEXT[] NOT NULL DEFAULT '{}',
  scopes          TEXT[] NOT NULL DEFAULT '{}',
  is_confidential BOOLEAN NOT NULL DEFAULT FALSE,
  is_first_party  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS oauth_authorization_codes (
  code_hash      VARCHAR(64) PRIMARY KEY,
  client_id      VARCHAR(80) NOT NULL REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id     UUID REFERENCES auth_sessions(id) ON DELETE CASCADE,
  redirect_uri   VARCHAR(500) NOT NULL,
  scope          VARCHAR(300) NOT NULL,
  nonce          VARCHAR(500),
  code_challenge VARCHAR(200) NOT NULL,
  expires_at     TIMESTAMPTZ NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_auth_codes_expires ON oauth_authorization_codes (expires_at);

-- family_id: aynı girişten türeyen jeton zinciri. Bir halka ikinci kez
-- kullanılırsa zincirin tamamı iptal edilir (jeton hırsızlığı tespiti).
CREATE TABLE IF NOT EXISTS oauth_refresh_tokens (
  id         UUID PRIMARY KEY,
  family_id  UUID NOT NULL,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id  VARCHAR(80) NOT NULL REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
  session_id UUID REFERENCES auth_sessions(id) ON DELETE CASCADE,
  scope      VARCHAR(300) NOT NULL,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_refresh_family ON oauth_refresh_tokens (family_id);
CREATE INDEX IF NOT EXISTS idx_refresh_user ON oauth_refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_session ON oauth_refresh_tokens (session_id);

CREATE TABLE IF NOT EXISTS verification_tokens (
  purpose    VARCHAR(40) NOT NULL,
  token_hash VARCHAR(64) NOT NULL,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (purpose, token_hash)
);
CREATE INDEX IF NOT EXISTS idx_verification_user ON verification_tokens (purpose, user_id);

/* ---------------------------------------------------------------- katalog */

CREATE TABLE IF NOT EXISTS categories (
  id        UUID PRIMARY KEY,
  slug      VARCHAR(120) NOT NULL UNIQUE,
  name      VARCHAR(120) NOT NULL,
  parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  position  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products (
  id          UUID PRIMARY KEY,
  store_id    UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  slug        VARCHAR(140) NOT NULL,
  sku         VARCHAR(60),
  name        VARCHAR(250) NOT NULL,
  description VARCHAR(5000) NOT NULL,
  price_cents BIGINT NOT NULL CHECK (price_cents >= 0),
  stock       INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  image_url   VARCHAR(500) NOT NULL,
  status      VARCHAR(20) NOT NULL DEFAULT 'active'
                CHECK (status IN ('draft', 'active', 'archived')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (store_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_products_store ON products (store_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products (category_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_price ON products (price_cents);

/* ------------------------------------------------------------------ sepet */

CREATE TABLE IF NOT EXISTS carts (
  id                  UUID PRIMARY KEY,
  user_id             UUID REFERENCES users(id) ON DELETE CASCADE,
  status              VARCHAR(20) NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'converted')),
  converted_order_id  UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Bir kullanıcının aynı anda yalnızca bir açık sepeti olabilir.
CREATE UNIQUE INDEX IF NOT EXISTS uq_carts_active_user
  ON carts (user_id) WHERE user_id IS NOT NULL AND status = 'active';
CREATE INDEX IF NOT EXISTS idx_carts_updated ON carts (updated_at);

CREATE TABLE IF NOT EXISTS cart_items (
  cart_id    UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity   INTEGER NOT NULL CHECK (quantity > 0),
  added_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (cart_id, product_id)
);

/* -------------------------------------------------------------- siparişler */

CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1000;

CREATE TABLE IF NOT EXISTS orders (
  id                 UUID PRIMARY KEY,
  order_number       VARCHAR(30) NOT NULL UNIQUE,
  -- Misafir siparişinde NULL. Kullanıcı silinse de sipariş kaydı korunur.
  user_id            UUID REFERENCES users(id) ON DELETE SET NULL,
  contact_email      VARCHAR(254) NOT NULL,
  contact_full_name  VARCHAR(150) NOT NULL,
  contact_phone      VARCHAR(30) NOT NULL,
  shipping_address   JSONB NOT NULL,
  note               VARCHAR(500),
  total_cents        BIGINT NOT NULL CHECK (total_cents >= 0),
  status             VARCHAR(30) NOT NULL
                       CHECK (status IN ('pending_payment','paid','payment_failed','cancelled','completed')),
  -- Takip kodunun yalnızca SHA-256 özeti saklanır.
  tracking_code_hash VARCHAR(64) NOT NULL,
  placed_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders (user_id, placed_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status, placed_at);
CREATE INDEX IF NOT EXISTS idx_orders_tracking ON orders (order_number, tracking_code_hash);

-- Bir sipariş birden çok mağazaya bölünebilir; her parçayı mağaza kendi yönetir.
CREATE TABLE IF NOT EXISTS order_packages (
  id              UUID PRIMARY KEY,
  order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  store_id        UUID NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  subtotal_cents  BIGINT NOT NULL CHECK (subtotal_cents >= 0),
  status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','preparing','shipped','delivered','cancelled','refunded')),
  -- Stok yalnızca bir kez iade edilsin diye.
  stock_released  BOOLEAN NOT NULL DEFAULT FALSE,
  carrier         VARCHAR(100),
  tracking_number VARCHAR(100),
  tracking_url    VARCHAR(500),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (order_id, store_id)
);
CREATE INDEX IF NOT EXISTS idx_packages_store ON order_packages (store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_packages_order ON order_packages (order_id);

CREATE TABLE IF NOT EXISTS order_items (
  id                UUID PRIMARY KEY,
  package_id        UUID NOT NULL REFERENCES order_packages(id) ON DELETE CASCADE,
  -- Ürün siparişte geçtiği sürece silinemez; arşivlenir.
  product_id        UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_name      VARCHAR(250) NOT NULL,
  product_image_url VARCHAR(500) NOT NULL,
  unit_price_cents  BIGINT NOT NULL CHECK (unit_price_cents >= 0),
  quantity          INTEGER NOT NULL CHECK (quantity > 0)
);
CREATE INDEX IF NOT EXISTS idx_order_items_package ON order_items (package_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items (product_id);

CREATE TABLE IF NOT EXISTS payments (
  id           UUID PRIMARY KEY,
  order_id     UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  provider     VARCHAR(40) NOT NULL,
  status       VARCHAR(20) NOT NULL CHECK (status IN ('succeeded', 'failed')),
  amount_cents BIGINT NOT NULL,
  reference    VARCHAR(80) NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments (order_id);

/* ---------------------------------------------------------------- destek */

CREATE SEQUENCE IF NOT EXISTS ticket_reference_seq START 1000;

CREATE TABLE IF NOT EXISTS support_tickets (
  id         UUID PRIMARY KEY,
  reference  VARCHAR(30) NOT NULL UNIQUE,
  user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  store_id   UUID REFERENCES stores(id) ON DELETE SET NULL,
  order_id   UUID REFERENCES orders(id) ON DELETE SET NULL,
  email      VARCHAR(254) NOT NULL,
  full_name  VARCHAR(150) NOT NULL,
  subject    VARCHAR(200) NOT NULL,
  message    VARCHAR(5000) NOT NULL,
  status     VARCHAR(20) NOT NULL DEFAULT 'open'
               CHECK (status IN ('open','in_progress','answered','closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tickets_user ON support_tickets (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_store ON support_tickets (store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON support_tickets (status, created_at DESC);

CREATE TABLE IF NOT EXISTS support_messages (
  id             UUID PRIMARY KEY,
  ticket_id      UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  author_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  body           VARCHAR(5000) NOT NULL,
  is_staff       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_support_messages_ticket ON support_messages (ticket_id, created_at);

/* ------------------------------------------------ olay kutusu ve denetim */

-- Transactional outbox: olay, onu doğuran veriyle AYNI transaction'da yazılır.
-- Worker bu tabloyu okuyup RabbitMQ'ya aktarır; "veriyi yazdım ama olayı
-- yayınlayamadım" durumu oluşmaz.
CREATE TABLE IF NOT EXISTS outbox_messages (
  id             BIGSERIAL PRIMARY KEY,
  type           VARCHAR(80) NOT NULL,
  aggregate_type VARCHAR(40) NOT NULL,
  aggregate_id   UUID,
  payload        JSONB NOT NULL,
  occurred_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at   TIMESTAMPTZ,
  attempts       INTEGER NOT NULL DEFAULT 0,
  last_error     TEXT
);
CREATE INDEX IF NOT EXISTS idx_outbox_unpublished
  ON outbox_messages (occurred_at) WHERE published_at IS NULL;

CREATE TABLE IF NOT EXISTS audit_log (
  id             BIGSERIAL PRIMARY KEY,
  actor_user_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  action         VARCHAR(80) NOT NULL,
  resource_type  VARCHAR(40) NOT NULL,
  resource_id    VARCHAR(80),
  metadata       JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip             VARCHAR(45),
  user_agent     VARCHAR(300),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log (actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_log (resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log (created_at DESC);
