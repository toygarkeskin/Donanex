# Kimlik, yetkilendirme ve OAuth 2.1

Sistem kendi yetkilendirme sunucusunu çalıştırır. Dışarıdan bir kimlik sağlayıcıya bağımlı
değildir; bu yüzden demo ortamında da eksiksiz çalışır.

## Akış: yetkilendirme kodu + PKCE

Tarayıcıdaki uygulama **açık istemcidir** (public client): parola saklayamaz. Bu yüzden her girişte
tek kullanımlık bir doğrulayıcı üretir ve yalnızca özetini sunucuya gönderir (PKCE, RFC 7636).
Yetkilendirme kodu çalınsa bile doğrulayıcıyı bilmeyen saldırgan kodu jetona çeviremez.

```text
 Tarayıcı                         API                          Veritabanı
    │                              │                                │
    │ 1. verifier üret, özetini    │                                │
    │    GET /oauth/authorize      │                                │
    ├─────────────────────────────►│ istemci + redirect_uri doğrula │
    │                              │ oturum var mı? ───────────────►│
    │ 2a. oturum YOK               │                                │
    │ ◄──302 /giris?auth=<id>──────┤ istek önbelleğe (15 dk)        │
    │                              │                                │
    │ 3. POST /api/auth/sign-in    │                                │
    │    (e-posta, parola, auth)   │ parola doğrula ───────────────►│
    │                              │ SSO oturumu aç (HttpOnly)      │
    │ ◄──{ redirectTo }────────────┤ yetkilendirme kodu üret        │
    │                              │                                │
    │ 2b. oturum VAR               │                                │
    │ ◄──302 redirect_uri?code=…───┤ (sessiz yeniden yetkilendirme) │
    │                              │                                │
    │ 4. POST /oauth/token         │                                │
    │    code + code_verifier      │ kodu TÜKET (ayrı transaction)  │
    │                              │ PKCE doğrula                   │
    │ ◄──access_token + id_token───┤ refresh_token → HttpOnly çerez │
```

**Giriş formu neden uygulamanın içinde?** Kullanıcı tanıdık bir ekranda kalsın diye. Akış yine de
standart yetkilendirme kodu akışıdır: sunucu bekleyen isteği saklar, giriş bitince kodu üretir ve
dönülecek adresi verir. Form sunucuya ayrı bir uçtan konuşur; jeton hiçbir zaman formla alınmaz.

### Kodun tüketilme sırası önemlidir

Kod, doğrulamadan **önce** ve kendi transaction'ında tüketilir. Doğrulama başarısız olsa bile kod
yanmış sayılır. Aynı işleme konsaydı, hata fırlatıldığında geri alma kodu geri getirir ve saldırgan
aynı kodla sınırsız deneme yapabilirdi.

## Jetonlar

| Jeton | Biçim | Ömür | Nerede durur |
|---|---|---|---|
| Erişim (access) | JWT, **RS256** | 15 dk | Yalnızca tarayıcı belleğinde (Pinia) |
| Yenileme (refresh) | Opak, 32 bayt | 14 gün | **HttpOnly** çerez (`pzr_rt`, SameSite=Strict) |
| Kimlik (id_token) | JWT, RS256 | 15 dk | İstemcide, `openid` istendiğinde |
| SSO oturumu | Opak | 14 gün | HttpOnly çerez (`pzr_sso`, SameSite=Lax) |
| Yetkilendirme kodu | Opak | 2 dk | Yalnızca özeti veritabanında |

**Erişim jetonu neden çerezde değil?** Çerezde olsaydı her isteğe kendiliğinden eklenir ve CSRF
yüzeyi büyürdü. Bellekte tutulunca sekme kapanınca kaybolur; oturum, HttpOnly yenileme çereziyle
sessizce geri gelir.

**Neden RS256 (asimetrik)?** Jetonu yalnızca bu servis üretebilir, ama açık anahtarla (JWKS)
herkes doğrulayabilir. Yeni bir servis eklendiğinde ona gizli anahtar dağıtmak gerekmez.

Algoritma jeton doğrulamasında sabittir: `alg: none` ya da HMAC'e düşürme saldırıları reddedilir.

### Döndürmeli yenileme ve hırsızlık tespiti

Her yenilemede yeni bir yenileme jetonu verilir, eskisi harcanmış işaretlenir. Jetonlar bir **aile**
(`family_id`) altında zincirlenir.

Harcanmış bir jeton ikinci kez kullanılırsa, bu jetonun çalındığı anlamına gelir: **tüm aile ve
oturum iptal edilir**. İptal kendi transaction'ında kalıcı yapılır, hata sonra fırlatılır — aksi
halde geri alma iptali de silerdi.

### Erişim jetonunun içinde ne var, ne yok

```json
{
  "iss": "http://localhost:8090",
  "sub": "<kullanıcı id>",
  "aud": "pazar-web",
  "exp": 1793900000, "iat": 1793899100, "jti": "…",
  "scope": "openid profile email shop store:manage admin",
  "sid": "<oturum id>",
  "roles": [{ "role": "STORE_OWNER", "store": "<mağaza id>" }],
  "sv": 3
}
```

**İzinler jetona gömülmez.** Gömülseydi, yetkisi alınan bir kullanıcı jeton süresi dolana kadar
yetkili kalırdı. İzinler her istekte sunucuda çözülür (Redis'te 5 dk önbellekli); rol değişimi
önbelleği siler ve değişiklik anında geçerli olur.

`sv` (session version) parola değiştiğinde artar; eski erişim jetonları aynı anda geçersizleşir.

## Her istekte ne denetlenir

1. İmza ve süre (jetonun kendisi)
2. Oturum sürümü — parola değiştiyse eski jetonlar düşer
3. Hesap durumu — askıya alınmışsa erişim yok
4. İzin — `policy.can(izin, { storeId })`

## Roller ve izinler

Dört sistem rolü vardır. Roller silinemez; yeni rol eklenebilir.

| Rol | Kapsam | Ne yapar |
|---|---|---|
| `SYSTEM_ADMIN` | sistem geneli | Her şey |
| `STORE_OWNER` | **mağazaya bağlı** | Kendi mağazasının ürünleri, siparişleri, çalışanları, ayarları |
| `STORE_STAFF` | **mağazaya bağlı** | Ürün ve sipariş işler; mağaza ayarına ve çalışanlara dokunamaz |
| `CUSTOMER` | sistem geneli | Yönetim izni yok; kendi verisine sahiplik üzerinden erişir |

Rol ataması `user_roles` tablosundadır ve `store_id` taşıyabilir. Mağazaya bağlı bir atama
**yalnızca o mağazada** geçerlidir.

### Kapsam kuralı

İzin kataloğundaki her iznin bir kapsamı vardır: `global`, `store` ya da `both`.

- Sistem geneli izinler (`user:read`, `store:approve`, `system:settings`…) **yalnızca** sistem
  geneli bir atamayla kazanılır. Mağazaya bağlı bir rol bu izni taşısa bile vermez — böylece bir
  mağaza sahibi kendine sistem yetkisi devşiremez.
- Mağaza izinleri `{ storeId }` kapsamıyla sorulur. Kapsam verilmeden sorulursa geçmez.

Bu mantık `domain/identity/AccessPolicy.js` içinde, veritabanı ve HTTP bilmeyen saf bir nesnededir;
bu yüzden doğrudan test edilebilir.

### İki kat denetim

1. **Rota:** `requirePermission("catalog:product:write", (req) => ({ storeId: req.params.storeId }))`
2. **Handler:** `assertCan(context, "catalog:product:write", { storeId })`

İkincisi gereksiz görünür ama bir rotanın yanlışlıkla korumasız bırakılması durumunda iş mantığının
yine de yetkisiz çalışmamasını sağlar.

Ayrıca **sahiplik sorgunun parçasıdır**: "başkasının siparişi" ile "olmayan sipariş" aynı 404'ü
döndürür, böylece numara deneyerek varlık öğrenilemez.

## İlk kurulum

İlk açılışta sistem yöneticisi yoksa oluşturulur. `BOOTSTRAP_ADMIN_PASSWORD` boşsa güçlü bir parola
üretilir ve iki yere yazılır: konsola (bir kez) ve `/app/var/bootstrap-admin.txt` dosyasına.
Veritabanında yalnızca scrypt özeti durur.

```bash
docker compose exec api cat /app/var/bootstrap-admin.txt
```

Sistemde en az bir yönetici kalmalıdır: son yöneticinin rolü kaldırılamaz, hesabı askıya alınamaz,
kimse kendi hesabının durumunu değiştiremez.

## Parolalar

scrypt, N=2^16, r=8, p=2, kullanıcıya özel tuz. Biçim: `scrypt$N$r$p$tuz$anahtar`.

Parametreler sertleştirilirse eski özetler ilk girişte sessizce yükseltilir (`needsRehash`).

Kullanıcı bulunamadığında da aynı hesaplama yapılır (`verifyDummy`): yanıt süresi hangi
e-postaların kayıtlı olduğunu ele vermez. Hatalı e-posta ve hatalı parola aynı mesajı döndürür.

Parola kuralı tek yerdedir (`domain/identity/User.js`): en az 10 karakter, harf + rakam, yaygın
parola listesinde olmamak, e-posta adını içermemek.

## Uçlar

| Uç | Ne yapar |
|---|---|
| `GET /.well-known/openid-configuration` | OIDC keşif belgesi |
| `GET /oauth/jwks` | Açık anahtar seti |
| `GET /oauth/authorize` | Yetkilendirme (yalnızca `code`, PKCE S256 zorunlu) |
| `POST /oauth/token` | `authorization_code` · `refresh_token` · `client_credentials` |
| `POST /oauth/revoke` | Jeton iptali (RFC 7009 — geçersiz jetona da başarı döner) |
| `GET /oauth/userinfo` | OIDC kullanıcı bilgisi |
| `POST /api/auth/sign-in` · `register` · `sign-out` | Arayüzün kimlik uçları |
| `POST /api/auth/password/forgot` · `reset` · `email/verify` | Parola ve e-posta akışları |

`client_credentials` makineden makineye entegrasyon içindir ve yalnızca gizli istemcilere açıktır.

## Parola sıfırlama

Bağlantı tek kullanımlıktır ve 30 dakika geçerlidir. Veritabanında yalnızca HMAC özeti tutulur.

Jeton adresin **`#` sonrasında** taşınır: bu kısım sunucuya gönderilmez, bu yüzden erişim
günlüklerine ve `Referer` başlığına düşmez. Arayüz jetonu okuduktan sonra adres çubuğundan da siler.

İstek ucu, bir e-postanın kayıtlı olup olmadığını **asla** ele vermez: adres kayıtlı olsa da
olmasa da aynı yanıt döner ve yanıt gönderim işlemini beklemez.

Sıfırlama başarılı olunca kullanıcının tüm oturumları ve yenileme jetonları iptal edilir.
