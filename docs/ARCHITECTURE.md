# Mimari

## Neden bu mimari

Bir e-ticaret sisteminin en pahalı hatası, iş kurallarının çerçeveye ve veritabanına yapışmasıdır:
"stok ne zaman iade edilir" sorusunun cevabı bir SQL sorgusunun içine gömülünce, kural ne test
edilebilir ne de güvenle değiştirilebilir.

Bu yüzden kurallar en içte, bağımlılıksız bir katmanda durur; veritabanı, kuyruk ve HTTP en dışta,
değiştirilebilir ayrıntılar olarak kalır.

## Katmanlar

```text
┌────────────────────────────────────────────────────────┐
│ presentation/http    Express rotaları, ara katmanlar    │
│   · HTTP'yi komut/sorguya çevirir                       │
│   · yetki denetiminin birinci katı                      │
└───────────────┬────────────────────────────────────────┘
                ▼
┌────────────────────────────────────────────────────────┐
│ application          kullanım senaryoları (CQRS)        │
│   · her senaryo bir dosya: Mesaj + Handler              │
│   · dış dünyayı yalnızca PORT isimleriyle tanır         │
└───────────────┬────────────────────────────────────────┘
                ▼
┌────────────────────────────────────────────────────────┐
│ domain               saf iş kuralları                   │
│   · hiçbir şeye bağımlı değil (require bile etmez)      │
│   · Money, Order, Cart, AccessPolicy, OrderStatus…      │
└────────────────────────────────────────────────────────┘
                ▲
┌───────────────┴────────────────────────────────────────┐
│ infrastructure       portların somut karşılıkları        │
│   · PostgreSQL, Redis, RabbitMQ, SMTP, kripto           │
│   · yalnızca bootstrap/container.js içinde bağlanır     │
└────────────────────────────────────────────────────────┘
```

Okları tersine çevirmeye çalışan her kod `tests/architecture` tarafından reddedilir.

## CQRS

Komut ve sorgu ayrımı burada yalnızca isimlendirme değildir:

| | Komut | Sorgu |
|---|---|---|
| Ne yapar | Durumu **değiştirir** | Yalnızca **okur** |
| Veri yolu | `commands.execute(...)` | `queries.ask(...)` |
| Erişim | `unitOfWork` → repository'ler, tek transaction | read model → doğrudan DTO döndüren SQL |
| Sayı | 38 | 26 |

Bus, mesaj sınıfının `Command` mı `Query` mi olduğunu kayıt sırasında denetler; yanlış veri yoluna
gönderilen mesaj çalışma zamanında değil, açılışta yakalanır.

**Okuma tarafı domain nesnesi kurmaz.** `PgOrderReadModel` tek sorguda, arayüzün beklediği
iç içe JSON'u üretir. Bu, CQRS'in asıl kazancıdır: okuma için ORM nesnesi şişirmek yerine ekranın
ihtiyacı neyse o yazılır.

### Bir komutun yolculuğu

`POST /api/orders` → `PlaceOrderCommand`:

1. **Rota** gövdeyi komuta çevirir, hız sınırını ve Origin denetimini geçirir.
2. **Bus** komutu handler'a verir; günlükleme middleware'i süreyi ölçer (içerik yazılmaz).
3. **Handler** `unitOfWork.run` ile tek transaction açar:
   - sepet satırları okunur,
   - ürünler `SELECT … FOR UPDATE` ile **kilitlenir** (sıralı kilit, deadlock yok),
   - `Order.place` domain kuralını uygular: tutar sunucuda hesaplanır, stok ve mağaza durumu
     denetlenir, sipariş mağaza bazlı paketlere bölünür,
   - sipariş ve satırlar yazılır, stok düşülür, sepet kapatılır,
   - `order.placed` olayı **aynı transaction'da** outbox'a yazılır.
4. Transaction kapanır. Katalog önbelleği temizlenir.
5. **worker** outbox'u okur, olayı RabbitMQ'ya aktarır, e-posta tüketicisi postayı gönderir.

Hata hangi adımda olursa olsun transaction geri alınır: yarım sipariş, kaybolmuş stok ya da
"yazıldı ama olay yayınlanamadı" durumu oluşmaz.

## Portlar

`application/shared/ports.js` application katmanının dış dünyadan beklediği her şeyi sayar.
`assertPorts` açılışta her adaptörün sözleşmeyi karşıladığını doğrular.

| Port | Ne için |
|---|---|
| `unitOfWork` | yazma tarafı transaction sınırı |
| `catalogReadModel`, `orderReadModel`, `storeReadModel`, `cartReadModel`, `userReadModel`, `supportReadModel`, `dashboardReadModel`, `healthReadModel` | okuma tarafı |
| `tokenIssuer` | RS256 JWT üretimi/doğrulaması, JWKS |
| `opaqueTokens` | tek kullanımlık kodlar (HMAC özetli) |
| `passwordHasher` | scrypt |
| `pkce` | PKCE S256 doğrulaması |
| `cache` | Redis (ya da bellek içi) |
| `mailer`, `clock`, `ids`, `logger`, `safeEqual` | yan servisler |

Bir altyapıyı değiştirmek (ör. Redis yerine başka bir önbellek) yalnızca yeni bir sınıf yazmayı ve
`container.js` içinde bağlamayı gerektirir.

## Transaction sınırı ve eşzamanlılık

`PgUnitOfWork` açık transaction'ı **`AsyncLocalStorage`** içinde tutar.

Bu bir ayrıntı değil, doğruluk koşuludur: UnitOfWork örneği tüm istekler tarafından paylaşılır.
Açık transaction nesne üzerinde bir alanda saklansaydı, eş zamanlı iki istek aynı bağlantıyı
kullanır; `SELECT … FOR UPDATE` ile alınan kilit anlamını yitirir ve iki sipariş aynı son ürünü
satabilirdi. Entegrasyon testindeki "eş zamanlı siparişler stoğu aşamaz" senaryosu tam olarak bunu
korur.

## Transactional outbox

Olaylar doğrudan RabbitMQ'ya yazılmaz. Önce `outbox_messages` tablosuna, onları doğuran veriyle
**aynı transaction içinde** yazılır. `worker` süreci bu tabloyu `FOR UPDATE SKIP LOCKED` ile okuyup
kuyruğa aktarır.

Kazanç: veritabanı ile kuyruk arasında "biri oldu, öbürü olmadı" durumu kalmaz. Kuyruk geçici olarak
erişilemezse olay kaybolmaz, yalnızca gecikir.

## Önbellek

Redis iki iş yapar:

- **Katalog sorguları** (60 sn) — ürün listesi ve detayı. Katalog ya da **stok** değiştiğinde
  `catalog:` ön ekli anahtarların tamamı silinir.
- **Yetki çözümü** (5 dk) — kullanıcının rol/izin listesi ve oturum sürümü. Rol değişimi, parola
  değişimi ve askıya alma anında anahtarı siler, böylece yetki değişiklikleri jeton süresini
  beklemeden geçerli olur.

Önbellek erişilemezse sistem yavaşlar ama çalışmayı sürdürür; okuma hataları yutulur.

## Süreçler

| Süreç | İşi |
|---|---|
| `api` | HTTP. Birden çok kopya çalışabilir. |
| `worker` | Outbox aktarımı, e-posta tüketicisi, bakım işleri. Tek kopya yeterlidir; işler `SKIP LOCKED` kullandığı için birden çok kopya da güvenlidir. |

Bakım işleri: süresi dolan ödenmemiş siparişleri iptal etme (stok iadesiyle), süresi geçmiş
jeton/oturum temizliği, terk edilmiş misafir sepetlerinin silinmesi.

## Arayüz

Vue 3 tek sayfa uygulaması. Üç yerleşim: vitrin (`ShopLayout`), kimlik ekranları (`PlainLayout`),
paneller (`PanelLayout`). Panel ekranları tembel yüklenir; vitrine gelen ziyaretçi yönetim kodunu
indirmez.

Oturum durumu Pinia'da. Erişim jetonu bellekte tutulur, yenileme jetonu HttpOnly çerezdedir;
uygulama açılışında sessiz yenileme denenir, böylece sayfa yenilense de oturum sürer.
