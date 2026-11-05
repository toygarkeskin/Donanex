# HTTP API

Taban adres: `/api`. OAuth uçları kök altındadır (`/oauth`, `/.well-known`).

Gövde ve yanıt **JSON**'dur (`/oauth/token` ayrıca `application/x-www-form-urlencoded` kabul eder).
Para alanları her zaman **kuruş** ve tam sayıdır: `priceCents: 6700000` = 67.000,00 ₺.

## Kimlik doğrulama

```http
Authorization: Bearer <access_token>
```

Jetonun nasıl alındığı: [AUTH.md](AUTH.md). Yenileme jetonu başlıkla değil, HttpOnly çerezle gider;
`POST /oauth/token` ile `grant_type=refresh_token` çağrısı gövdede jeton istemez.

## Hata biçimi

```json
{ "error": "validation_error", "message": "Adet en az 1 olmalıdır.", "details": { "field": "quantity" } }
```

| Durum | `error` | Ne zaman |
|---|---|---|
| 400 | `validation_error` · `invalid_body` | Girdi kurallara uymuyor |
| 401 | `unauthorized` | Jeton yok, süresi geçmiş ya da oturum düşmüş |
| 403 | `forbidden` | Jeton geçerli ama izin yok |
| 404 | `not_found` | Kayıt yok **ya da** size ait değil (ayrım bilinçli olarak yapılmaz) |
| 409 | `conflict` | Çakışma (e-posta kayıtlı, durum geçişi geçersiz) |
| 413 | `payload_too_large` | Gövde sınırı aşıldı (64 KB; toplu ürün içe aktarmada 1 MB) |
| 429 | `rate_limited` | Hız sınırı aşıldı |
| 500 | `internal_error` | Ayrıntı **gizlenir**, günlüğe `RequestId` ile yazılır |
| 503 | `service_unavailable` | Yapılandırma eksik |

Her yanıtta `X-Request-Id` başlığı vardır; Seq'te aynı numarayla isteğin tüm izi bulunur.

## Durum değiştiren isteklerde zorunlu koşullar

- `Origin` ya da `Sec-Fetch-Site` denetimi geçilmelidir (CSRF). Tarayıcı bunu kendiliğinden yapar;
  `curl` ile denerken `-H "Origin: http://localhost:8090"` ekleyin.
- Sepet uçları, oturumu olmayan ziyaretçi için **HttpOnly `pzr_cart` çerezi** kullanır; ilk sepet
  isteğinde kendiliğinden verilir. `curl -c` / `-b` ile çerez kavanozu tutun.

## Hız sınırları

Her limitin kendi Redis sayacı vardır; biri dolduğunda diğerleri etkilenmez.

| Grup | Sınır |
|---|---|
| Genel API | geniş, kötüye kullanım koruması |
| Giriş / kayıt | dar; başarılı giriş sayaca yazılmaz |
| Parola sıfırlama | çok dar |
| Sipariş verme | dar (stok kilitleme suistimaline karşı) |

---

## Vitrin (yetki gerekmez)

| Uç | Ne yapar |
|---|---|
| `GET /api/products` | Ürün listesi. `q`, `category`, `store`, `minPrice`, `maxPrice`, `sort`, `page`, `pageSize` |
| `GET /api/products/:storeSlug/:productSlug` | Ürün detayı |
| `GET /api/categories` | Kategori ağacı |
| `GET /api/storefront/stores` | Etkin mağazalar |
| `GET /api/storefront/stores/:slug` | Mağaza vitrini |

Katalog yanıtları 60 saniye önbelleklenir. Stok ya da ürün değişince önbellek anında temizlenir.

## Sepet (misafir de kullanır)

| Uç | Ne yapar |
|---|---|
| `GET /api/cart` | Sepeti döndürür; fiyatlar **her istekte güncel üründen** okunur |
| `POST /api/cart/items` | `{ productId, quantity }` — stok ve mağaza durumu denetlenir |
| `PUT /api/cart/items/:productId` | `{ quantity }`; 0 satırı siler |
| `DELETE /api/cart/items/:productId` | Satırı siler |
| `DELETE /api/cart` | Sepeti boşaltır |

Sepet **sunucuda** durur. Giriş ya da kayıt olunduğunda misafir sepeti kullanıcının sepetiyle
birleştirilir: aynı ürün varsa adetler toplanır, stok sınırı aşılmaz.

## Sipariş

| Uç | Yetki | Ne yapar |
|---|---|---|
| `POST /api/orders` | — | Sipariş verir. Misafir ise `contact` + `shippingAddress` zorunlu; yanıtta **takip kodu** döner (bir kez) |
| `POST /api/orders/:orderId/payment` | — ya da sahiplik | Ödemeyi işler. Misafir için `trackingCode` zorunlu |
| `POST /api/orders/:orderId/cancel` | sahiplik | Ödenmemiş siparişi iptal eder, stoğu iade eder |
| `POST /api/orders/track` | — | `{ orderNumber, trackingCode }` ile misafir siparişi sorgular |

Tutar **sunucuda** hesaplanır; gövdede gönderilen fiyat ve toplam yok sayılır.

## Kimlik

| Uç | Ne yapar |
|---|---|
| `POST /api/auth/register` | Kayıt; misafir sepetini taşır. Bekleyen OAuth isteği varsa `redirectTo` döner |
| `POST /api/auth/sign-in` | Giriş; SSO oturumu açar |
| `POST /api/auth/sign-out` | Oturumu ve yenileme jetonunu sunucuda iptal eder |
| `POST /api/auth/password/forgot` | Sıfırlama bağlantısı. Adresin kayıtlı olup olmadığını **ele vermez** |
| `POST /api/auth/password/reset` | `{ token, password }`; tüm oturumları düşürür |
| `POST /api/auth/email/verify` | E-posta doğrulama |

## Hesap (giriş gerekir)

| Uç | Ne yapar |
|---|---|
| `GET /api/me` | Profil, roller, mağazalar |
| `PUT /api/me/profile` · `PUT /api/me/password` | Profil ve parola |
| `GET/POST /api/me/addresses` · `PUT/DELETE /api/me/addresses/:addressId` | Adres defteri |
| `GET /api/me/orders` · `GET /api/me/orders/:orderId` | Sipariş geçmişi (sahiplik sorgunun parçası) |
| `GET /api/me/tickets` · `GET /api/me/tickets/:ticketId` | Destek talepleri |
| `POST /api/me/store-application` | Mağaza açma başvurusu (onaya düşer) |
| `POST /api/support/tickets` | Destek talebi; misafir de açabilir |

## Mağaza paneli — `/api/stores/:storeId/...`

Her uç izni **`{ storeId }` kapsamıyla** sorar: başka mağazanın kimliği 403 döner.

| Uç | İzin |
|---|---|
| `GET /api/stores/:storeId` · `GET …/dashboard` | `store:read` |
| `PUT /api/stores/:storeId` | `store:write` |
| `GET …/products` | `catalog:product:read` |
| `POST …/products` · `PUT …/products/:productId` · `PATCH …/products/:productId/status` | `catalog:product:write` |
| `POST …/products/bulk` | `catalog:product:write` (CSV ile toplu içe aktarma) |
| `DELETE …/products/:productId` | `catalog:product:delete` (siparişte geçen ürün arşivlenir, silinmez) |
| `GET …/orders` · `GET …/orders/:packageId` | `order:read` |
| `PATCH …/orders/:packageId/status` · `…/shipping` | `order:fulfil` |
| `GET/POST …/members` | `store:member:manage` |
| `GET …/tickets` · `PUT …/tickets/:ticketId` | `support:read` / `support:respond` |

Mağaza panelinde görülen sipariş birimi **pakettir** (`order_packages`), sipariş değil: kargo ve
hazırlık durumu paket üzerindedir. Neden: [DATA-MODEL.md](DATA-MODEL.md#siparişin-iki-seviyesi).

## Yönetim paneli — `/api/admin/...`

Bu izinlerin kapsamı `global`'dir: mağazaya bağlı bir rol bunları **asla** vermez.

| Uç | İzin |
|---|---|
| `GET /api/admin/dashboard` | `store:read` + `user:read` |
| `GET /api/admin/users` | `user:read` |
| `POST /api/admin/users/:userId/roles` | `role:assign` |
| `PATCH /api/admin/users/:userId/status` | `user:write` (son yönetici askıya alınamaz) |
| `GET /api/admin/stores` · `PATCH /api/admin/stores/:storeId/status` | `store:read` / `store:approve` |
| `POST /api/admin/categories` | `catalog:category:manage` |
| `GET /api/admin/orders` · `/:orderId` | `order:read` |
| `GET /api/admin/tickets` · `PUT /api/admin/tickets/:ticketId` | `support:read` / `support:respond` |

## OAuth 2.1 / OIDC

| Uç | Ne yapar |
|---|---|
| `GET /.well-known/openid-configuration` | Keşif belgesi |
| `GET /oauth/jwks` · `/oauth/jwks.json` | Açık anahtar seti |
| `GET /oauth/authorize` | Yetkilendirme — yalnızca `response_type=code`, **PKCE S256 zorunlu** |
| `GET /oauth/authorize/request/:id` | Giriş ekranının bekleyen isteği okuması için |
| `POST /oauth/token` | `authorization_code` · `refresh_token` · `client_credentials` |
| `POST /oauth/revoke` | RFC 7009 — geçersiz jetona da `200` döner |
| `GET /oauth/userinfo` | OIDC kullanıcı bilgisi (Bearer) |

## Sağlık

| Uç | Ne yapar |
|---|---|
| `GET /api/health` | Süreç ayakta mı (hız sınırı ve oturum çözümü uygulanmaz) |
| `GET /api/ready` | Veritabanı ve Redis erişilebilir mi |
