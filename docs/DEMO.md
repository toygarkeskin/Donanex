# Demo rehberi

Bu dosya, projeyi birine gösterirken izlenecek yolu anlatır. Hiçbir dış hesap, gerçek ödeme ya da
gerçek e-posta ayarı gerekmez: ödeme benzetimle, e-posta ise gerçek bir SMTP sunucusuyla (Mailpit)
çalışır — posta **gönderilir** ama internete çıkmaz, Mailpit arayüzünde görünür.

## Ayağa kaldırma

```bash
node backend/scripts/generate-env.js > .env     # yalnızca ilk kurulumda
docker compose up -d --build
```

İlk açılışta şema uygulanır, roller eşitlenir, sistem yöneticisi oluşturulur ve demo verisi eklenir.
Demo verisi **yalnızca veritabanı boşken** yazılır; ikinci açılışta tekrar eklenmez.

| Ne | Adres |
|---|---|
| Site | <http://localhost:8090> |
| Günlükler (Seq) | <http://localhost:8092> |
| E-postalar (Mailpit) | <http://localhost:8093> |
| Kuyruk (RabbitMQ) | <http://localhost:8094> |

## Hesaplar

Sistem yöneticisinin parolası ilk açılışta üretilir:

```bash
docker compose exec api cat /app/var/bootstrap-admin.txt
```

Demo hesaplarının hepsinde aynı parola vardır: **`Pazar2026Demo`**

| Rol | E-posta | Ne görür |
|---|---|---|
| Sistem Yöneticisi | `.txt` dosyasındaki adres | Yönetim paneli: mağaza onayı, kullanıcılar, roller |
| Mağaza Sahibi | `teknoloji@pazar.test` | Teknoloji Deposu paneli (5 ürün, siparişler, çalışanlar) |
| Mağaza Sahibi | `oyuncu@pazar.test` | Oyuncu Dünyası paneli (6 ürün) |
| Mağaza Çalışanı | `calisan@pazar.test` | Teknoloji Deposu paneli — **ayarlar ve çalışanlar sekmesi yok** |
| Müşteri | `musteri@pazar.test` | 2 siparişi, 1 adresi, 1 destek talebi var |
| Müşteri | `ahmet@pazar.test` | Boş hesap |

## Hazır veri

4 mağaza, 16 ürün, 8 kategori, 2 sipariş, 1 destek talebi.

Siparişlerden biri **ödenmiş ve iki mağazaya bölünmüştür** — ilk paketi "hazırlanıyor" durumundadır,
yani mağaza panelinde iş akışı hemen görünür. Diğeri **ödeme bekler**; bakım işi süresi dolunca onu
iptal eder ve stoğu geri verir.

## Gösterim senaryoları

### 1. Misafir alışverişi — kaydolmadan satın alma (spec'in can alıcı maddesi)

1. Siteyi **gizli pencerede** aç, ürün detayına gir, sepete ekle.
2. Sepette "Üye olmadan da satın alabilirsiniz" bilgisi görünür.
3. Sepet → Ödeme. Ad, e-posta, adres yaz, siparişi ver.
4. Ödeme ekranında kart bilgisi istenmez (benzetim); "Ödemeyi tamamla".
5. Sipariş numarası ve **takip kodu** verilir. Bu kodu kopyala.
6. Çıkış yapmış haldeyken "Sipariş takip" ekranına numara + kodu gir: sipariş görünür.
7. Mailpit'i aç: sipariş onay e-postası orada.

> Sepet sunucuda durur; tarayıcıda yalnızca HttpOnly bir sepet çerezi vardır. Bu yüzden sayfa
> yenilenince, sekme kapanıp açılınca sepet kaybolmaz.

### 2. Misafir sepeti kayıt olurken kaybolmuyor

1. Gizli pencerede 3 ürün sepete ekle.
2. Sepetten "Kayıt olarak devam et"e bas.
3. Kayıt formunda şu uyarı çıkar:
   *"Sepetinizdeki 3 ürün kayıt olduğunuzda hesabınıza taşınacak."*
4. Kaydol. Sepet aynı 3 ürünle, kullanıcı hesabına bağlanmış olarak durur.

Aynı şey girişte de olur: misafir sepeti varsa kullanıcının sepetiyle **birleştirilir** (aynı ürün
varsa adetler toplanır, stok sınırı aşılmaz).

### 3. Mağaza paneli — siparişi kargoya verme

1. `teknoloji@pazar.test` ile gir. Paneldeki özet kutuları: ciro, bekleyen paket, stoğu azalan ürün.
2. Siparişler → "hazırlanıyor" paketi aç.
3. Kargo firması ve takip numarası gir, durumu **kargoya verildi** yap.
4. Müşteri hesabına (`musteri@pazar.test`) geç: paket kargoda, takip numarası görünür.
5. Mailpit: müşteriye kargo bildirimi gitmiş.

> Bir paket geriye alınamaz: teslim edilmiş ya da iptal edilmiş paket yeniden hazırlığa çekilemez.
> İptal/iade stoğu **bir kez** geri verir (`stock_released`).

### 4. Ürün yönetimi ve stok

1. Mağaza panelinde Ürünler → Yeni ürün. Ad, fiyat, stok, kategori gir.
2. Ürün vitrinde **anında** görünür (stok değişince katalog önbelleği temizlenir).
3. Stoğu 0 yap: vitrinde "tükendi" olur ve sepete eklenemez.

### 5. Rol ayrımı

1. `calisan@pazar.test` ile gir (aynı mağaza).
2. Ürün ve siparişlere erişir; **Mağaza ayarları** ve **Çalışanlar** sekmeleri yoktur.
3. Adres çubuğundan `/magaza/.../ayarlar` adresine gitmeyi dene: sunucu da reddeder (403).
   Arayüzdeki gizleme kolaylık içindir, denetim sunucudadır.

### 6. Mağazalar arası yalıtım

1. `oyuncu@pazar.test` ile gir, adres çubuğuna diğer mağazanın kimliğini yaz.
2. Sunucu 403 döner. Mağaza rolü **yalnızca kendi mağazasında** geçerlidir.

### 7. Yönetim paneli — mağaza başvurusu onayı

1. Müşteri hesabıyla "Mağaza aç" başvurusu gönder.
2. Yönetici hesabıyla gir: Mağazalar → başvuru **beklemede** listelenir.
3. Onayla. Başvuran kullanıcı o mağazanın sahibi rolünü kazanır.
4. Mailpit: başvurana onay e-postası gitmiş.
5. Başvuran tekrar giriş yapınca menüde mağaza paneli vardır — **jeton süresini beklemeden**
   (izinler jetona gömülü değildir, her istekte çözülür).

### 8. Güvenlik gösterimi

| Ne denenir | Ne olur |
|---|---|
| Başka kullanıcının sipariş numarasıyla `/api/orders/<id>` | 404 — "yok" ile "senin değil" aynı yanıt |
| Takip kodu olmadan misafir siparişini açmak | 404 |
| Hatalı parolayla üst üste giriş | 429, bir süre kilit |
| Tarayıcı konsolundan `localStorage` | Jeton yoktur; yalnızca bellekte |
| Sekme kapat-aç | Oturum sürer (HttpOnly yenileme çerezi) |
| Parolayı değiştir | Diğer tarayıcıdaki oturum düşer |

### 9. Günlükler ve kuyruk

- **Seq** (8092): her istek yapılandırılmış olarak; `RequestId` ile bir isteğin tüm izi.
  Hata varsa yığın izi burada — kullanıcıya gösterilen yanıtta değil.
- **RabbitMQ** (8094): `pazar.events` exchange'i, `email` kuyruğu. Sipariş verince mesaj akışı görünür.
- Olaylar önce `outbox_messages` tablosuna, veriyle **aynı transaction'da** yazılır. Kuyruğu
  durdurup sipariş verirsen olay kaybolmaz; kuyruk dönünce gönderilir.

## Demoyu sıfırlama

```bash
docker compose down -v        # veritabanı dahil her şeyi siler
docker compose up -d --build  # demo verisi yeniden yazılır
```

> `down -v` yeni bir yönetici parolası üretir; `/app/var/bootstrap-admin.txt` dosyasını tekrar okuyun.

## Demo neden üretim ayarında çalışmaz

`SEED_DEMO_DATA=true`, `PAYMENTS_MODE=simulated` ve `COOKIE_SECURE=false` değerleri
`NODE_ENV=production` iken config doğrulamasından **geçmez**; sunucu açılmaz. Demo bu yüzden
`NODE_ENV=development` ile çalışır. Üretime almadan önce yapılacaklar:
[SECURITY.md](SECURITY.md#canlıya-almadan-önce).
