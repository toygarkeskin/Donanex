# Güvenlik

## Alınan önlemler

Her satırdaki "nerede sınanıyor" sütunu, önlemin bir testle korunduğunu gösterir; kod değişince
test kırılır.

| Risk | Önlem | Nerede sınanıyor |
|---|---|---|
| Başkasının siparişine erişim (IDOR) | Sahiplik sorgunun parçasıdır; "başkasının" ile "olmayan" aynı 404'ü döner | entegrasyon |
| Misafir siparişinin ele geçirilmesi | Ödeme ve görüntüleme takip kodu ister; kodun yalnızca HMAC özeti saklanır | entegrasyon |
| Mağazalar arası veri sızması | Her uç `{ storeId }` kapsamıyla yetki sorar; sorgular `store_id` ile sınırlıdır | entegrasyon, birim |
| Yetki yükseltme | Mağazaya bağlı rol sistem geneli izni veremez | birim (`AccessPolicy`) |
| Fiyat oynaması | Tutar sunucuda hesaplanır; istemciden gelen fiyat ve toplam yok sayılır | entegrasyon |
| Fazla satış (overselling) | `SELECT … FOR UPDATE` ile satır kilidi, tek transaction | entegrasyon (10 eş zamanlı istek) |
| **Transaction sızması** | Açık transaction `AsyncLocalStorage`'da; istekler birbirinin transaction'ını kullanamaz | entegrasyon |
| Stok kilitleme suistimali | Sipariş hız sınırı; ödenmeyen sipariş süre sonunda iptal edilir, stok iade edilir | birim, entegrasyon |
| SQL enjeksiyonu | Yalnızca parametreli sorgu; `LIKE` jokerleri kaçırılır; kimlikler UUID doğrulamasından geçer | entegrasyon |
| XSS | Vue varsayılan olarak kaçırır; `v-html` hiç kullanılmaz; katı CSP (`script-src 'self'`) | tarayıcı denetimi |
| CSRF | `SameSite` çerezler + durum değiştiren isteklerde `Origin` / `Sec-Fetch-Site` denetimi | entegrasyon |
| Jeton çalınması | 15 dk erişim jetonu; yenileme jetonu HttpOnly çerezde; döndürmeli yenileme + aile iptali | entegrasyon |
| Yetkilendirme kodu çalınması | PKCE S256 **zorunlu**; kod tek kullanımlık ve doğrulamadan önce tüketilir | entegrasyon |
| Açık yönlendirme | `redirect_uri` **tam eşleşme**; doğrulanmadan hiçbir yönlendirme yapılmaz | birim, entegrasyon |
| Jeton sahteciliği | RS256 sabit; `alg: none` ve HMAC'e düşürme reddedilir; `iss`/`aud`/`exp` denetlenir | birim |
| Yetki değişiminin gecikmesi | İzinler jetona gömülmez, her istekte çözülür; değişimde önbellek silinir | entegrasyon |
| Parola çalınması | scrypt (N=2^16, r=8, p=2), kullanıcıya özel tuz, girişte otomatik yükseltme | birim |
| Kaba kuvvet | Uç başına ayrı Redis önekli hız sınırı; başarılı giriş sayılmaz; nginx istek sınırı | entegrasyon |
| Hesap sayımı | Giriş ve parola sıfırlama kayıtlı e-postayı ele vermez; aynı süre, aynı yanıt | entegrasyon |
| Oturum devamlılığı | Parola değişimi diğer oturumları düşürür; çıkış sunucuda iptal eder | entegrasyon |
| Askıya alınan hesap | Oturumlar kapatılır, erişim anında kesilir | entegrasyon |
| Sıfırlama jetonunun sızması | Jeton adresin `#` kısmında taşınır — günlüklere ve `Referer`'a düşmez; tek kullanımlık, 30 dk | entegrasyon |
| Yüklenen dosyanın zararlı olması | Tür baytlardan doğrulanır (başlıktan değil), ad sunucuda üretilir, 2 MB sınırı, SVG kabul edilmez | entegrasyon |
| Yüklenen görselin yol çıkışı | Ad kalıbı sabittir; kalıba uymayan ad diske hiç gitmez | entegrasyon |
| Zararlı ürün görseli | Yalnızca `/images/…` ya da `https://`; `javascript:`, `data:`, yol çıkışı reddedilir | birim, entegrasyon |
| Zararlı kargo bağlantısı | Yalnızca `http`/`https` | birim |
| Hata ayrıntısının sızması | Beklenmeyen hatalarda yığın izi ve SQL gizlenir; istek numarasıyla günlüğe yazılır | entegrasyon |
| Günlükten kişisel veri sızması | Sorgu dizesi ve gövde yazılmaz; mesaj içeriği günlüğe girmez | kod |
| HTTP düz metin trafiği | Üretim katmanında Caddy TLS sonlandırır, 80 → 443 yönlendirir, HSTS ekler | manuel |
| Konteyner kaçışı | Root olmayan kullanıcı, salt okunur dosya sistemi, tüm capability'ler kaldırıldı, `no-new-privileges` | manuel |
| Veritabanına dışarıdan erişim | `data` ağı `internal`; DB, Redis ve kuyruk dışarı açılmaz | manuel |
| Gizli değerlerin sızması | `.env` git ve imaj dışında; zayıf ayarlarla sunucu başlamaz | birim (config) |

## Katı CSP

```text
default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline';
font-src 'self' data:; img-src 'self' data: blob: https:; connect-src 'self';
form-action 'self'; base-uri 'none'; frame-ancestors 'none'
```

Satır içi script yoktur. `style-src 'unsafe-inline'` Vue'nun `:style` bağlamaları için gereklidir;
script çalıştırmaya izin vermez.

## Canlıya almadan önce

1. **HTTPS zorunlu.** Hazır: `docker-compose.prod.yml` + `Caddyfile` önüne Caddy koyar, sertifikayı
   Let's Encrypt'ten kendisi alır ve yeniler; 80 → 443 yönlendirmesi ve HSTS otomatiktir.
   `.env.production.example` dosyasını örnek alın (`DOMAIN`, `ACME_EMAIL`, `COOKIE_SECURE=true`,
   `PUBLIC_URL=https://…`). Sizin yapmanız gereken: alan adını almak, DNS A kaydını sunucuya
   yöneltmek, 80 ve 443 portlarını açmak.

   ```bash
   docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
   ```

   Bu katmanda web konteynerinin kendi portu kapanır ve gözlem arayüzleri (Seq, Mailpit, RabbitMQ)
   dışarı hiç açılmaz — onlara SSH tüneliyle erişilir.
2. **Gerçek ödeme sağlayıcısı bağlayın**, `PAYMENTS_MODE` değerini benzetimden çıkarın.
   Benzetim açıkken, bir siparişin takip kodunu bilen herkes onu "ödendi" yapabilir.
3. `SEED_DEMO_DATA=false` yapın ve demo hesaplarını silin.
4. **Tüm gizli değerleri yenileyin:** veritabanı, `TOKEN_PEPPER`, JWT anahtar çifti, RabbitMQ, SMTP.
5. **Veritabanı yedeği kurun.** Şu an `db-data` volume'ünü yedekleyen hiçbir şey yok.
6. Seq ve RabbitMQ arayüzlerine erişimi kısıtlayın (şu an yalnızca `127.0.0.1`'e açık).
7. **Yüklenen görseller `uploads` volume'unda durur** ve yedeklenmiyor; veritabanı yedeğine bu
   volume de eklenmelidir. Dosyalar silinen ürünle birlikte temizlenmez — disk zamanla birikir,
   periyodik bir temizlik işi gerekir.

## Bilinen sınırlar

Bunlar bilinçli olarak kapsam dışında bırakıldı; bir saldırı yüzeyi değil, eksik özelliktir.

- **E-posta doğrulaması zorunlu değil.** Doğrulama bağlantısı gönderilir ama doğrulanmamış hesap da
  alışveriş yapabilir. Kayıt ucu "bu e-posta zaten kayıtlı" der — bu, hesabın varlığını ele verir;
  kayıt formunda kullanıcının bunu bilmesi gerektiği için kabul edildi ve hız sınırıyla korunuyor.
- **İki adımlı doğrulama (2FA) yok.**
- **Rol kataloğu koddan gelir.** Arayüzden yeni rol/izin tanımlanamaz; değişiklik için dağıtım gerekir.
- **Denetim kaydı arayüzden görüntülenemez.** `audit_log` tablosu dolar ama ekranı yoktur.
- **İade akışı kısmidir.** Paket "iade edildi" yapılabilir ve stok döner; para iadesi gerçek ödeme
  sağlayıcısına bağlı olmadığı için yoktur.
- **Mağaza komisyonu/ödeşme yok.** Çok satıcılı bir donanexın mali tarafı modellenmedi.
- **Hukuki metinler yok.** KVKK aydınlatma metni, mesafeli satış sözleşmesi, iade koşulları
  işletmeden gelmelidir.
- **Tek dil.** Arayüz yalnızca Türkçedir.

## Güvenlik açığı bildirimi

Bir açık bulursanız genel bir issue açmadan önce depo sahibine özel olarak bildirin.
