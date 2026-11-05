# Veri modeli

PostgreSQL 16. Şema `backend/src/infrastructure/persistence/postgres/migrations/` altındadır ve
API açılışında otomatik uygulanır (advisory lock ile, tek seferlik).

## Genel kurallar

- **Para her zaman `BIGINT` kuruştur.** `NUMERIC` yuvarlama sürprizi ve kayan nokta hatası olmaz.
  pg sürücüsü BIGINT'i metin döndürdüğü için `pool.js` içinde tek yerde sayıya çevrilir.
- **Kimlikler UUID.** Sıralı sayı olsaydı sipariş ve kullanıcı sayısı dışarıdan tahmin edilebilirdi.
  Kullanıcıya gösterilen numaralar ayrıdır: `PZ-2026-001234`, `DT-001001`.
- **E-posta her zaman küçük harfle yazılır**, benzersizliği `lower(email)` indeksi sağlar.
- **Silme davranışı bilinçlidir** (aşağıdaki tabloda).
- **Gizli hiçbir şey açık saklanmaz:** parola scrypt özeti, jetonlar HMAC özeti.

## İlişkiler

```text
users ──< user_roles >── roles ──< role_permissions >── permissions
  │            │
  │            └── store_id ──► stores        (mağazaya bağlı rol ataması)
  │
  ├──< user_addresses
  ├──< auth_sessions ──< oauth_refresh_tokens
  ├──< verification_tokens
  ├──< carts ──< cart_items ──► products
  └──< orders

stores ──< products ──► categories
  │            │
  │            └──< order_items
  └──< order_packages

orders ──< order_packages ──< order_items
  │              │
  │              └── store_id ──► stores
  ├──< payments
  └──< support_tickets ──< support_messages

outbox_messages        (olay kutusu — kimseye bağlı değil)
audit_log ──► users    (actor)
```

## Siparişin iki seviyesi

Bu modelin can alıcı yeri burasıdır. Çok satıcılı bir pazarda bir sipariş birden çok mağazaya
düşebilir; müşteri tek ödeme yapar ama kargoyu her mağaza kendi yönetir.

```text
orders              müşterinin siparişi ve ödemesi
  └─ order_packages mağaza başına bir paket  ← kargo ve hazırlık durumu BURADA
       └─ order_items  ürün satırları
```

- `orders.status`: `pending_payment` → `paid` → `completed`, ya da `payment_failed` / `cancelled`
- `order_packages.status`: `pending` → `preparing` → `shipped` → `delivered`,
  ya da `cancelled` / `refunded`

Siparişin genel durumu paketlerden **türetilir**: tüm paketler teslim/iptal/iade olduğunda sipariş
tamamlanır, hepsi iptal olduysa sipariş iptal olur.

`order_packages.stock_released` bayrağı stoğun yalnızca bir kez iade edilmesini sağlar. Stoğu iade
edilmiş bir paket yeniden aktif bir duruma alınamaz; aksi halde aynı stok ikinci kez satılabilirdi.

## Tablolar

### Kimlik

| Tablo | Not |
|---|---|
| `users` | `session_version` parola değişince artar ve eski jetonları düşürür. `status`: active/suspended |
| `user_addresses` | Kullanıcı silinirse adresler de gider (CASCADE) |
| `roles`, `permissions`, `role_permissions` | Domain'deki katalogdan her açılışta eşitlenir — tek doğru kaynak koddadır |
| `user_roles` | `store_id` NULL ise sistem geneli. `NULL = NULL` olmadığı için benzersizlik `COALESCE` ile kurulur |
| `auth_sessions` | Tarayıcı oturumu; yalnızca jeton özeti saklanır |
| `oauth_clients` | Kayıtlı istemciler, `redirect_uris` tam eşleşmeyle doğrulanır |
| `oauth_authorization_codes` | 2 dk ömür, `DELETE … RETURNING` ile atomik tüketilir |
| `oauth_refresh_tokens` | `family_id` ile zincirlenir; tekrar kullanım tüm zinciri iptal eder |
| `verification_tokens` | Parola sıfırlama ve e-posta doğrulama; `(purpose, token_hash)` birincil anahtar |

### Mağaza ve katalog

| Tablo | Not |
|---|---|
| `stores` | `status`: pending/active/suspended. Sahibi silinemez (`RESTRICT`) |
| `categories` | Kendine referanslı (`parent_id`), silinirse alt kategori köksüz kalır (`SET NULL`) |
| `products` | `(store_id, slug)` benzersiz — iki mağaza aynı adresi kullanabilir. Mağaza silinirse ürünleri gider (`CASCADE`) |

### Sepet ve sipariş

| Tablo | Not |
|---|---|
| `carts` | `user_id` NULL ise misafir sepeti. Kısmi benzersiz indeks: bir kullanıcının aynı anda tek açık sepeti olur |
| `cart_items` | **Fiyat tutulmaz.** Fiyat her görüntülemede güncel üründen okunur; istemci fiyat belirleyemez, eski fiyat sepette donup kalmaz |
| `orders` | `user_id` NULL ise misafir siparişi. Kullanıcı silinse de sipariş kalır (`SET NULL`) |
| `order_items` | Ürün adı, görseli ve birim fiyatı **o anki haliyle kopyalanır**; ürün sonradan değişse de sipariş geçmişi bozulmaz. `product_id` `RESTRICT` — siparişte geçen ürün silinemez, arşivlenir |
| `payments` | Her ödeme denemesi kaydedilir (başarılı/başarısız) |

### Altyapı

| Tablo | Not |
|---|---|
| `outbox_messages` | Olaylar veriyle aynı transaction'da yazılır; worker `SKIP LOCKED` ile aktarır. Kısmi indeks yalnızca yayınlanmamışları tarar |
| `audit_log` | Kim, ne zaman, neyi değiştirdi. İş transaction'ının parçasıdır: işlem geri alınırsa kayıt da geri alınır |

## Silme davranışları

| İlişki | Davranış | Neden |
|---|---|---|
| kullanıcı → sipariş | `SET NULL` | Hesap silinse de satış kaydı ve muhasebe bozulmaz |
| mağaza → ürün | `CASCADE` | Mağaza kapanınca kataloğu da kapanır |
| ürün → sipariş satırı | `RESTRICT` | Geçmiş sipariş bir ürünü işaret ediyorsa o ürün silinemez — arşivlenir |
| mağaza → paket | `RESTRICT` | Siparişi olan mağaza silinemez |
| sipariş → paket/satır | `CASCADE` | Sipariş bir bütündür |
| kullanıcı → oturum/jeton | `CASCADE` | Hesap gidince erişim de gider |

## İndeksler

Sorgu desenlerine göre: sipariş listeleri `(user_id, placed_at DESC)` ve
`(store_id, created_at DESC)`, takip `(order_number, tracking_code_hash)`, vitrin
`(status, created_at DESC)` ve `price_cents`, süresi dolan siparişler `(status, created_at)`,
outbox için yalnızca yayınlanmamışları kapsayan kısmi indeks.

## Numaralandırma

- Sipariş: `PZ-<yıl>-<6 hane>` — `order_number_seq`
- Destek talebi: `DT-<6 hane>` — `ticket_reference_seq`

Bu numaralar okunabilir olsun diye sıralıdır. Tek başlarına erişim vermezler: sipariş görüntülemek
için ayrıca takip kodu ya da sahiplik gerekir.
