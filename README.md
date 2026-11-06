# Donanex — çok satıcılı teknoloji mağazası

Birden çok mağazanın tek vitrinde satış yaptığı, tek sepet ve tek ödemeyle alışveriş yapılan bir
e-ticaret uygulaması.

- **Arayüz:** Vue 3 + Vite + Tailwind CSS 4 (tek sayfa uygulaması)
- **Sunucu:** Node.js + Express 5, **Clean Architecture + CQRS**
- **Kimlik:** Kendi **OAuth 2.1 / OpenID Connect** sunucumuz — PKCE, RS256 JWT, döndürmeli yenileme jetonu
- **Veri:** PostgreSQL 16 · **Önbellek:** Redis · **Kuyruk:** RabbitMQ · **Günlük:** Seq
- **Demo e-postası:** Mailpit — posta gerçekten gönderilir, internete çıkmaz

> **Bu bir demo ortamıdır.** Ödemeler benzetimdir; gerçek para hareketi yoktur.
> Canlıya almadan önce [docs/SECURITY.md](docs/SECURITY.md) dosyasındaki listeyi tamamlayın.

---

## Hızlı başlangıç

```bash
node backend/scripts/generate-env.js > .env
docker compose up --build -d
```

İlk açılış şemayı kurar, rolleri eşitler, sistem yöneticisini oluşturur ve demo verisini ekler.

| Ne | Adres |
|---|---|
| **Site** | http://localhost:8090 |
| Yönetim paneli | http://localhost:8090/yonetim |
| Mağaza paneli | http://localhost:8090/magaza |
| Günlükler (Seq) | http://localhost:8092 |
| **E-postalar (Mailpit)** | http://localhost:8093 |
| Kuyruklar (RabbitMQ) | http://localhost:8094 |
| API sağlık | http://localhost:8090/api/health · `/api/ready` |
| OIDC keşif | http://localhost:8090/.well-known/openid-configuration |

### Giriş bilgileri

**Sistem yöneticisi** ilk açılışta oluşturulur. Parola `.env` içinde verilmediyse rastgele üretilir ve
iki yere yazılır — konsola ve konteyner içindeki bir dosyaya:

```bash
docker compose logs api | grep -A6 "SİSTEM YÖNETİCİSİ"
docker compose exec api cat /app/var/bootstrap-admin.txt
```

**Demo hesapları** (hepsinin parolası `Donanex2026Demo`):

| Rol | E-posta |
|---|---|
| Mağaza Sahibi | `teknoloji@donanex.test`, `oyuncu@donanex.test`, `komponent@donanex.test`, `ekran@donanex.test` |
| Mağaza Çalışanı | `calisan@donanex.test` |
| Müşteri | `musteri@donanex.test`, `ahmet@donanex.test` |

Demoyu nasıl göstereceğiniz: [docs/DEMO.md](docs/DEMO.md)

---

## Neler çalışıyor

**Kayıtsız kullanıcı (misafir)**
- Ürünleri gezer, arar, filtreler
- **Sepete ekler** — sepet sunucuda tutulur, çerezde yalnızca kimliği taşınır
- **Kayıt olmadan sipariş verir**, tek kullanımlık takip koduyla siparişini izler
- Destek talebi açar
- Her adımda kayıt olmanın faydası hatırlatılır, ama hiçbir yerde zorunlu tutulmaz

**Kayıt olduğunda sepeti kaybolmaz.** Misafir sepeti hesaba taşınır; aynı ürün iki sepette de
varsa adetler toplanır.

**Müşteri** — sipariş geçmişi, sipariş iptali, adres defteri, profil, parola değiştirme,
parola sıfırlama, destek talepleri

**Mağaza Sahibi / Çalışanı** — kendi mağazasının panosu, ürün ekleme/düzenleme/arşivleme,
**CSV ile toplu ürün aktarma** (önizlemeli, satır satır doğrulamalı), **panelden görsel yükleme**
(PNG/JPEG/WebP, 2 MB), kendi paketlerinin sipariş akışı, kargo bilgileri, çalışan yönetimi,
destek talepleri

**Her rolde** — üst menüdeki tek düğmeyle **açık/koyu tema**; tercih tarayıcıda saklanır,
ilk ziyarette işletim sistemi ayarı kullanılır.

**Sistem Yöneticisi** — genel pano ve 14 günlük grafik, mağaza başvuru onayı, mağaza askıya alma,
kullanıcı ve rol yönetimi, tüm siparişler, tüm destek talepleri

---

## Mimari

```text
                 ┌──────────────────────────────────────────────┐
 Tarayıcı ──────►│ web (nginx)  Vue derlemesi + /api, /oauth proxy│
                 └───────────────┬──────────────────────────────┘
                                 ▼
                 ┌──────────────────────────────────────────────┐
                 │ api  (Express 5)                             │
                 │   presentation → application → domain        │
                 │                     ▲                        │
                 │   infrastructure ───┘ (portları uygular)     │
                 └──┬────────────┬───────────┬─────────┬────────┘
                    ▼            ▼           ▼         ▼
                 Postgres      Redis      RabbitMQ    Seq
                    ▲                        ▲
                    │   outbox ──────────────┘
                    └───────── worker (olay aktarımı, e-posta, bakım)
```

**Bağımlılık yönü içeri doğrudur.** `domain` hiçbir şeye bağımlı değildir; `application` yalnızca
`domain`'e ve port sözleşmelerine bakar; somut altyapı (PostgreSQL, Redis, RabbitMQ, SMTP) yalnızca
`bootstrap/container.js` içinde bağlanır.

**CQRS:** 38 komut, 26 sorgu — toplam **64 kullanım senaryosu**, her biri kendi dosyasında.
Komut handler'ı read model'e, sorgu handler'ı unit of work'e dokunamaz.

Bu kuralların hiçbiri yalnızca belgede yazmaz: `tests/architecture` kuralı çiğneyen kodda kırılır.

Ayrıntılar: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · [docs/DATA-MODEL.md](docs/DATA-MODEL.md) ·
[docs/AUTH.md](docs/AUTH.md) · [docs/API.md](docs/API.md) · [docs/DECISIONS.md](docs/DECISIONS.md)

### Klasörler

```text
backend/src/
├── domain/              saf iş kuralları — bağımlılığı yok
│   ├── shared/          Money, guards, hatalar, olaylar
│   ├── identity/        AccessPolicy, Role, Permission, User, OAuthClient
│   ├── catalog/  stores/  ordering/  support/
├── application/         kullanım senaryoları (CQRS)
│   ├── shared/          cqrs/bus.js, ports.js, registry.js
│   └── <bağlam>/
│       ├── index.js     bağlamın dışa açık yüzü + handler kaydı
│       ├── commands/<Senaryo>.js
│       └── queries/<Senaryo>.js
├── infrastructure/      portların somut karşılıkları
│   ├── persistence/postgres/   UnitOfWork, repository'ler, read model'ler, migration'lar
│   ├── security/        RS256 jeton, scrypt, PKCE, opak jetonlar
│   ├── cache/  messaging/  logging/  mail/  support/
├── presentation/http/   Express uygulaması, rotalar, ara katmanlar
├── bootstrap/           composition root, ilk kurulum, zamanlanmış işler
├── main.js              API süreci
└── worker.js            outbox aktarımı, e-posta tüketicisi, bakım

frontend/src/
├── lib/                 api istemcisi, OAuth/PKCE, biçimlendirme
├── stores/              Pinia (oturum, sepet, bildirim)
├── components/  layouts/
└── views/               shop/ · auth/ · account/ · store/ · admin/
```

---

## Testler

```bash
# Tamamı: birim + mimari + gerçek PostgreSQL/Redis ile uçtan uca API
docker compose -f docker-compose.test.yml up --build --abort-on-container-exit --exit-code-from tests
docker compose -f docker-compose.test.yml down -v

# Altyapısız: yalnızca birim ve mimari testleri
cd backend && npm run test:unit
```

**120 test** — 52 entegrasyon, 58 birim, 10 mimari. Tek kullanımlık veritabanı kullanılır; gerçek
veriye, çalışan sisteme ve gerçek SMTP'ye dokunulmaz.

Testler yalnızca "mutlu yol"u değil, güvenlik sınırlarını da kontrol eder: eş zamanlı sipariş,
jeton hırsızlığı tespiti, mağazalar arası erişim, CSRF, SQL enjeksiyonu, hız sınırı.

---

## Geliştirme (Docker olmadan arayüz)

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d   # altyapı + API (8095)
cd frontend && npm install && npm run dev                              # Vite → http://localhost:5173
```

`docker-compose.dev.yml` ayrıca PostgreSQL'i 5434, Redis'i 6380 portundan bu bilgisayara açar.

---

## Ayarlar

Tüm ayarlar `.env` dosyasından okunur; örnekler ve açıklamalar
[.env.example](.env.example) içindedir. **Sunucu eksik ya da zayıf ayarlarla başlamayı reddeder** —
yanlış yapılandırılmış bir sistemin sessizce çalışmasındansa durup nedenini söylemesi yeğdir.

Canlı ortam için zorunlu olanlar: `COOKIE_SECURE=true`, `PAYMENTS_MODE` benzetim dışı,
`SEED_DEMO_DATA=false`, `PUBLIC_URL=https://…`.

---

## Kendi alan adınızla yayına alma (HTTPS)

Üretim katmanı önüne **Caddy** koyar; sertifikayı Let's Encrypt'ten kendisi alır ve süresi dolmadan
yeniler. HTTP'den HTTPS'ye yönlendirme ve HSTS otomatiktir — elle sertifika kopyalamazsınız.

**Sizin yapmanız gerekenler:**

1. Alan adı alın, **A kaydını** sunucunuzun IP'sine yöneltin.
2. Sunucuda **80 ve 443** portlarını açın (Caddy doğrulamayı bu portlardan yapar).
3. `.env.production.example` dosyasındaki satırları `.env` içine taşıyın: `DOMAIN`, `ACME_EMAIL`,
   `PUBLIC_URL=https://alanadiniz.com`, `COOKIE_SECURE=true`, `SEED_DEMO_DATA=false`.
4. Tüm gizli değerleri yenileyin: `node backend/scripts/generate-env.js`.

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Bu katmanda web konteynerinin kendi portu kapanır; siteye yalnızca HTTPS üzerinden girilir. Gözlem
arayüzleri (Seq, Mailpit, RabbitMQ) dışarı hiç açılmaz — onlara SSH tüneliyle bağlanılır:

```bash
ssh -L 8092:localhost:8092 kullanici@sunucu
```

> **Ödeme hâlâ benzetimdir.** Gerçek bir sağlayıcı bağlanmadan üretim yapılandırması ödemeyi
> reddeder: sipariş verilir, ödenemez. Ayrıntı: [docs/SECURITY.md](docs/SECURITY.md)

## Katkı

Depoda değişiklik yapacaklar için yol gösterici: [CONTRIBUTING.md](CONTRIBUTING.md) —
katman kuralları, yeni kullanım senaryosu nasıl eklenir, sık düşülen tuzaklar.

## Geliştirici

**Toygar Keskin**
