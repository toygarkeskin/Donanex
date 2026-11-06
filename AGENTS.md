# Bu depoda çalışma rehberi

Bu dosya, depoda değişiklik yapacak kişiler ve yapay zekâ ajanları içindir. Amacı: mimariyi tarif
etmek değil (onun için [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) var), **nereye ne yazılacağını
ve nelerin kırılacağını** söylemek.

## Önce bunu çalıştırın

```bash
cd backend && npm run test:unit          # hızlı: birim + mimari testleri, altyapı gerektirmez
```

Değişiklik bittiğinde tamamını çalıştırın:

```bash
docker compose -f docker-compose.test.yml up --build --abort-on-container-exit --exit-code-from tests
docker compose -f docker-compose.test.yml down -v
```

## Katman kuralları (testler zorlar)

`backend/tests/architecture/architecture.test.js` şunları kırılma noktası yapar:

| Kural | Neden |
|---|---|
| `domain` yalnızca `domain`'e bakar | İş kuralları çerçeveden ve veritabanından bağımsız kalsın |
| `application` yalnızca `application` + `domain` | Kullanım senaryoları altyapı tanımasın |
| `infrastructure` → `application`/`presentation` yasak | Bağımlılık yönü içeri doğrudur |
| `presentation` → `infrastructure` yasak, `pg` yasak | Rotalar somut altyapı bilmez |
| `presentation` yalnızca `application/<bağlam>` index'ini kullanır | Bağlamın iç yapısı dışarı sızmasın |
| Komut handler'ında `ReadModel` yok | CQRS yazma tarafı |
| Sorgu handler'ında `unitOfWork` yok | CQRS okuma tarafı |
| SQL yalnızca `infrastructure/persistence` altında | Sorgular tek yerde |

Bir kuralı çiğnemek gerekiyorsa testi değiştirmeden önce nedenini
[docs/DECISIONS.md](docs/DECISIONS.md) dosyasına yazın.

## Yeni kullanım senaryosu eklemek

1. Dosyayı açın: `backend/src/application/<bağlam>/commands/<Senaryo>.js`
   (ya da `queries/<Senaryo>.js`).
2. İçinde iki şey dışa açılır: `<Senaryo>Command` + `<Senaryo>Handler`
   (sorgu için `<Senaryo>Query`). Mesaj `Command` ya da `Query` sınıfından türemeli.
3. `backend/src/application/<bağlam>/index.js` içindeki listeye ekleyin. Başka kayıt yeri yoktur;
   `container.js` değişmez.
4. Rotayı `backend/src/presentation/http/routes/` altına yazın ve yetkiyi
   `requirePermission(...)` ile belirtin.
5. Test yazın: iş kuralı için `tests/unit/`, uçtan uca davranış için `tests/integration/api.test.js`.

## Yeni bağlam (bounded context) eklemek

`application/<ad>/index.js` dosyasını `defineContext({ name, commands, queries })` ile oluşturun ve
`bootstrap/container.js` içindeki `MODULES` listesine ekleyin. Başka dokunulacak yer yoktur.

## Yeni dış bağımlılık (port) eklemek

1. Sözleşmeyi `application/shared/ports.js` içine yazın.
2. Somut sınıfı `infrastructure/` altına koyun.
3. `bootstrap/container.js` içinde bağlayın.

`assertPorts` açılışta doğrular: eksik bir metot ilk istekte değil, sunucu kalkarken yakalanır.

## Sık düşülen tuzaklar

- **Transaction, istekler arasında paylaşılmaz.** `PgUnitOfWork` açık transaction'ı
  `AsyncLocalStorage`'da tutar. Burayı bir alana (`this.active` gibi) taşımayın; eş zamanlı istekler
  birbirinin transaction'ına yazar ve stok kilidi gibi kurallar sessizce bozulur.
- **Güvenlik etkisi olan adımı, hata fırlatacağınız transaction'a koymayın.** Yetkilendirme kodunu
  tüketmek ve çalınan jeton ailesini iptal etmek KENDİ transaction'larındadır
  (`application/identity/commands/ExchangeToken.js`); aynı işleme konsaydı geri alma bu etkiyi de
  silerdi.
- **Stok değiştiren her komut katalog önbelleğini temizlemeli:**
  `await this.cache.deleteByPrefix("catalog:")`. Yoksa satılmış ürün bir süre "stokta" görünür.
- **Hız sınırlarının Redis öneki ayrı olmalı.** Ortak önek tüm limitleri tek sayaca bağlar ve en dar
  limit bütün siteyi kilitler.
- **Para her yerde kuruş (tam sayı).** `domain/shared/Money` dışında aritmetik yapmayın.
  PostgreSQL BIGINT'i metin döndürdüğü için `pool.js` içinde sayıya çevrilir.
- **Kullanıcı girdisinden gelen her kimlik UUID doğrulamasından geçer** (`requireUuid`).
- **Kapsamlı yetki:** mağazaya bağlı izinler `{ storeId }` ile sorulur. Kapsamsız sorulursa
  mağaza rolü izni vermez — bu kasıtlıdır.
- **Tema bileşenlerde değil, belirteçte durur.** Bileşenler ham renk ya da `bg-white` yazmaz;
  `bg-surface` ve `ink-*` kullanır. Koyu tema yalnızca `style.css` içindeki
  `:root[data-theme="dark"]` bloğunda belirteçleri yeniden tanımlar. Yeni bir ekranda ham renk
  kullanırsanız o ekran koyu temada bozulur.
- **Yüklenen dosyanın adı kullanıcıdan gelmez.** `LocalFileStorage` adı kendisi üretir ve türü
  dosyanın ilk baytlarından doğrular; `Content-Type` başlığı tek başına kanıt değildir. SVG
  bilerek kabul edilmez. Okurken de ad kalıbı yeniden denetlenir.
- **Olaylar kendi kendine yeterli olmalı.** E-posta tüketicisi alıcıyı yalnızca olay içeriğinden
  bulur; veritabanına geri dönmez. Yeni olay eklerken `email` ve `fullName` koymayı unutmayın.

## Arayüz tarafı

- Erişim jetonu **yalnızca bellekte** (Pinia) tutulur; yenileme jetonu HttpOnly çerezdedir.
  `localStorage`'a jeton yazmayın.
- Tüm HTTP çağrıları `src/lib/api.js` üzerinden geçer; 401'de jeton bir kez sessizce yenilenir.
- Rotalardaki korumalar kullanım kolaylığı içindir, **güvenlik değildir**. Asıl denetim sunucudadır.
- Yeni bir ekran rol gerektiriyorsa hem `router/index.js` meta alanını hem sunucudaki izni ayarlayın.

## Demo ortamı

Demo verisi yalnızca `SEED_DEMO_DATA=true` iken ve veritabanı boşken eklenir. Üretim ayarlarında
config doğrulaması bu bayrağı reddeder. Demo hesapları ve senaryolar: [docs/DEMO.md](docs/DEMO.md).

## Değiştirmeden önce okunacaklar

| Dosya | Ne anlatır |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Katmanlar, CQRS, veri akışı |
| [docs/AUTH.md](docs/AUTH.md) | OAuth 2.1 akışları, jeton ömürleri, rol/izin modeli |
| [docs/DATA-MODEL.md](docs/DATA-MODEL.md) | Tablolar ve ilişkiler, silme davranışları |
| [docs/SECURITY.md](docs/SECURITY.md) | Alınan önlemler ve bilinen sınırlar |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Neden böyle yapıldı (ve neden öbür türlü yapılmadı) |
