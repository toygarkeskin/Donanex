# Kararlar

Her madde: ne yapıldı, neden, hangi seçenek **reddedildi** ve ne zaman gözden geçirilmesi gerekir.
Bir kuralı çiğnemek gerekiyorsa buraya yeni bir madde yazın.

---

## 1. Kendi yetkilendirme sunucumuz, sosyal giriş değil

Google/GitHub ile giriş eklemek daha az iş olurdu ama demo bir dış hesaba ve internet erişimine
bağımlı hale gelirdi; ayrıca rol/izin modelinin kalbi olan jeton üretimini kendimiz görmezdik.

OAuth 2.1 + OIDC'yi kendimiz uyguladık: authorization_code + PKCE, refresh rotation,
client_credentials, JWKS, keşif belgesi.

**Reddedilen:** Auth0/Keycloak. Keycloak çalışır ama demo için iki kat kaynak ister ve projenin
göstermek istediği şeyi (yetkilendirmenin nasıl kurulduğunu) kutunun içine saklar.

**Gözden geçir:** gerçek kurumsal SSO gerekirse harici bir IdP'yi **üst** kimlik sağlayıcı olarak
bağlamak, kendi sunucumuzu atmaktan kolaydır.

## 2. `jose` yerine `node:crypto`

RS256 imzalama, doğrulama ve JWK ihracı için `node:crypto` yetiyor. `jose` ESM'dir; CommonJS
projesinde dinamik `import()` ve test tarafında ek karmaşıklık getiriyordu.

**Sonuç:** üretim bağımlılığı sayısı düştü, JWT doğrulaması (algoritma sabitleme, `alg: none`
reddi) açıkça okunabilir bir dosyada durur ve doğrudan test edilir.

## 3. Erişim jetonu bellekte, yenileme jetonu HttpOnly çerezde

`localStorage` XSS'te okunabilir; çereze konan **erişim** jetonu ise her isteğe kendiliğinden
eklenip CSRF yüzeyini büyütür.

Bu yüzden: erişim jetonu yalnızca Pinia'da (bellekte), yenileme jetonu HttpOnly + SameSite=Strict
çerezde. Sayfa yenilenince sessiz yenileme oturumu geri getirir.

**Bedeli:** uygulama her açılışta bir yenileme isteği yapar. Kabul edildi.

## 4. İzinler jetona gömülmez

Gömülü izinler jeton süresi boyunca donar: yetkisi alınan bir kullanıcı 15 dakika yetkili kalır.

İzinler her istekte sunucuda çözülür, Redis'te 5 dk önbelleklenir; rol değişimi, parola değişimi ve
askıya alma önbelleği **siler** — değişiklik anında geçerli olur.

**Bedeli:** her istekte bir önbellek okuması. Yetki değişiminin anında geçmesi buna değer.

## 5. Siparişin iki seviyesi: `orders` → `order_packages`

Çok satıcılı bir sistemde bir sepet birden çok mağazaya düşer. Tek seviyeli bir sipariş modelinde
"sipariş kargoya verildi" ifadesi anlamsızdır: mağazalardan biri vermiş, öbürü vermemiş olabilir.

Ödeme ve tutar `orders`'ta, **kargo ve hazırlık durumu paket üzerindedir**. Siparişin genel durumu
paketlerden türetilir.

**Reddedilen:** her mağaza için ayrı sipariş. Müşteri tek ödeme yapıyor; ayrı siparişler ödemeyi,
iadeyi ve sipariş numarasını parçalardı.

## 6. Sepet sunucuda, tarayıcıda yalnızca sepet çerezi

Misafir sepetini `localStorage`'da tutmak kolaydı. Ama spec'in açık maddesi şu: *kullanıcı sepeti
doldurduktan sonra "kayıt olarak devam et" derse sepet kaybolmamalı*.

Sepet veritabanındadır (`carts.user_id IS NULL` → misafir), tarayıcı yalnızca HttpOnly bir sepet
kimliği taşır. Kayıt/giriş anında misafir sepeti kullanıcının sepetiyle birleştirilir.

**Kazanç:** sepet stok ve fiyat denetiminden geçer; istemci fiyat belirleyemez; sepet cihaz
değiştirse de (giriş sonrası) durur.

## 7. `cart_items` fiyat tutmaz

Fiyat her görüntülemede güncel üründen okunur.

Sepete eklenirken kopyalansaydı: istemciden gelen fiyat güvenilmez olur, aylar önce eklenen satır
eski fiyatla donar ve "sepetteki fiyat ile ödenen fiyat farklı" hatası kapıda beklerdi.

**Sipariş satırında ise tam tersi:** `order_items` ürün adını, görselini ve birim fiyatını o anki
haliyle **kopyalar** — ürün sonradan değişse de geçmiş sipariş bozulmaz.

## 8. Para `BIGINT` kuruş

`NUMERIC` doğru ama JavaScript tarafında metin/`Number` dönüşümünde yuvarlama sürprizi üretir;
`float` zaten baştan yanlıştır.

Her yerde tam sayı kuruş. Aritmetik yalnızca `domain/shared/Money` içinde.

**Tuzak:** pg sürücüsü BIGINT'i **metin** döndürür. Tek bir yerde (`pool.js`) tip çözücüsü
tanımlandı; bu yapılmadan önce `Money.fromCents("6700000")` "Tutar geçersiz." hatası veriyordu.

## 9. Açık transaction `AsyncLocalStorage`'da

İlk uygulamada `PgUnitOfWork` açık transaction'ı `this.active` alanında tutuyordu. UnitOfWork örneği
tüm isteklerde paylaşıldığı için **eş zamanlı iki istek aynı bağlantıyı kullanıyordu**:
`SELECT … FOR UPDATE` kilidi anlamını yitiriyor, stok negatife düşüyordu.

Bu, entegrasyon testindeki "eş zamanlı siparişler stoğu aşamaz" senaryosunda aralıklı 500'ler olarak
ortaya çıktı; kök neden veritabanı günlüğündeki `products_stock_check` ihlaliydi.

Açık transaction artık `AsyncLocalStorage` içindedir: her istek kendi async bağlamında kendi
transaction'ını görür. **Bu alan bir sınıf alanına geri taşınırsa hata sessizce geri gelir.**

## 10. Güvenlik etkisi olan adım, hata fırlatacak transaction'ın içinde durmaz

Yetkilendirme kodu doğrulamadan **önce** ve kendi transaction'ında tüketilir; çalınan yenileme
jetonunun ailesini iptal etmek de kendi transaction'ında kalıcı yapılır, hata sonra fırlatılır.

Aynı işleme konsalardı geri alma bu etkiyi de silerdi: saldırgan aynı kodla sınırsız deneme
yapabilir, çalınmış jeton ailesi iptal edilmemiş kalırdı. İkisi de entegrasyon testinde yakalandı.

## 11. Transactional outbox

Olay doğrudan RabbitMQ'ya yazılsaydı iki uçlu bir tutarsızlık kapısı açılırdı: veri yazıldı ama olay
gitmedi (e-posta yok), ya da olay gitti ama transaction geri alındı (olmayan sipariş için e-posta).

Olaylar `outbox_messages` tablosuna veriyle **aynı transaction'da** yazılır; `worker` süreci
`FOR UPDATE SKIP LOCKED` ile okuyup kuyruğa aktarır.

**Bedeli:** olaylar milisaniyeler yerine saniye içinde gider. E-posta için fazlasıyla yeterli.

## 12. Olaylar kendi kendine yeterli

E-posta tüketicisi alıcıyı yalnızca olay içeriğinden bulur, veritabanına geri dönmez.

Dönseydi: olay işlenirken kullanıcı silinmiş olabilir, worker'ın DB'ye erişimi şart olur ve tüketici
test etmesi zor bir bağımlılık zincirine girerdi. `STORE_APPROVED` olayında `email`/`fullName`
unutulmuştu; entegrasyon testi "alıcı yok" diye yakaladı.

## 13. Mimari testler

Katman kuralları yoruma bırakılmadı; `tests/architecture/architecture.test.js` dosya bazında
`require` yönlerini, CQRS ayrımını ve SQL'in yerini denetler.

Bu testler geliştirme sırasında **iki gerçek ihlal** yakaladı: presentation katmanının bağlam
içindeki bir dosyayı doğrudan import etmesi ve bir **Query** handler'ının `unitOfWork` kullanması.
İkisi de düzeltildi — test gevşetilmedi.

## 14. CQRS, ama event sourcing yok

Komut/sorgu ayrımı yazma tarafını tek transaction ve domain kurallarıyla, okuma tarafını ekranın
istediği şekli tek sorguda üreten read model'lerle kurar.

**Reddedilen:** event sourcing ve ayrı okuma veritabanı. Bu ölçekte faydası yok, karmaşıklığı büyük:
projeksiyon gecikmesi, yeniden oynatma, şema evrimi. Bugün tek PostgreSQL yetiyor.

## 15. Rol kataloğu koddan gelir

Roller ve izinler `domain/identity` içinde tanımlıdır ve her açılışta veritabanına eşitlenir.
Tek doğru kaynak koddadır.

**Sonucu:** arayüzden yeni izin tanımlanamaz, değişiklik dağıtım gerektirir. Bunun karşılığında izin
kodları kodda aranabilir, yazım hatası testle yakalanır ve bir ortamda var olup diğerinde olmayan
izin durumu oluşmaz.

## 16. İzinlerin kapsamı (`global` / `store` / `both`)

Mağaza sahibinin kendine sistem yetkisi devşirmesini engelleyen şey budur: `global` kapsamlı bir
izin yalnızca sistem geneli bir atamayla kazanılır, mağazaya bağlı rol bu izni taşısa bile vermez.

Mantık `domain/identity/AccessPolicy.js` içinde, HTTP ve veritabanı bilmeyen saf bir nesnededir;
doğrudan birim testiyle sınanır.

## 17. Yetki iki kat denetlenir

Rotada `requirePermission(...)`, handler'da `assertCan(...)`.

İkincisi gereksiz görünür. Amacı şu: bir rota yanlışlıkla korumasız bırakılırsa iş mantığı yine de
yetkisiz çalışmaz. Güvenlik tek bir satırın dikkatine bağlı kalmaz.

## 18. "Yok" ile "senin değil" aynı yanıtı döner

Başkasının siparişi de, olmayan sipariş de 404 döner. Sahiplik koşulu sorgunun **parçasıdır**, ayrı
bir kontrol değildir.

Ayrı olsaydı 403/404 farkı numara deneyerek kayıt varlığını öğrenmeye yarardı; ayrıca "kontrolü
yazmayı unutmak" mümkün olurdu — sorgunun parçası olduğu için unutulamaz.

## 19. Ödeme benzetimi, ama gerçek bir e-posta sunucusu

Spec "her şey demo edilebilsin, e-posta gerçekten gönderiliyormuş gibi davransın" diyor.

- **Ödeme:** `PAYMENTS_MODE=simulated`. Kart alanı yok, ödeme kaydı gerçek (`payments` tablosu),
  sipariş gerçekten `paid` olur.
- **E-posta:** gerçek SMTP ile **Mailpit**'e gönderilir. Kod yolu üretimdekiyle aynıdır; yalnızca
  varış noktası yereldir. "Sahte mailer" kullanılmadı: o zaman SMTP yolu hiç sınanmamış olurdu.

Üretim ayarlarında config doğrulaması `simulated` ödemeyi **reddeder** — benzetim yanlışlıkla
canlıya çıkamaz.

## 20. Demo `NODE_ENV=development` ile çalışır

`SEED_DEMO_DATA=true`, `PAYMENTS_MODE=simulated` ve `COOKIE_SECURE=false` üretimde reddedilir.
Demoyu üretim kılığına sokmak için bu doğrulamaları gevşetmek yerine demo açıkça geliştirme
ortamında bırakıldı: doğrulama sert kalsın, demo dürüst olsun.

## 21. Hız sınırlarının Redis öneki ayrı

Başta tüm limitler varsayılan öneki paylaşıyordu: tek sayaç, en dar limit (parola sıfırlama)
birkaç istekte bütün API'yi 429'a düşürüyordu.

Her limiterin kendi öneki var (`rl:<ad>:`). Yeni bir limiter eklerken önek vermeyi unutmayın.

## 22. Konteynerler root değil, dosya sistemi salt okunur

Tüm servisler root olmayan kullanıcıyla, `read_only: true`, `cap_drop: ALL` ve
`no-new-privileges` ile çalışır. Veritabanı, Redis ve kuyruk `internal: true` bir ağdadır;
dışarıya yalnızca web ve yönetim arayüzleri açılır.

**Tuzak:** `cap_drop: ALL` Redis imajının root'tan `redis` kullanıcısına düşmesini engeller
(`setpriv: setresuid failed`); bu yüzden `user: "redis"` açıkça verilir. Aynı şekilde yönetim
arayüzleri `internal` ağdan port yayınlayamaz — ayrı bir `admin` ağı eklendi.

## 23. Tailwind CSS v4, `@apply` zinciri yok

v4'te `@apply` başka bir **component** sınıfını (ör. `.btn`) uygulayamaz; yalnızca utility'leri
uygular. Bu yüzden buton türevleri ortak taban seçicisiyle birlikte tanımlanır.

Bu bir üslup tercihi değil, derleme hatasıdır: `Cannot apply unknown utility class 'btn'`.

## 24. Panel ekranları tembel yüklenir

Vitrine gelen ziyaretçi yönetim panelinin kodunu indirmez. Rotalar `() => import(...)` ile
tanımlıdır; ilk yük küçük kalır.

Rotalardaki rol korumaları **kullanım kolaylığı** içindir, güvenlik değildir: asıl denetim
sunucudadır.

## 25. Koyu tema belirteçle, bileşenle değil

Her bileşene `dark:` varyantı yazmak 39 dosyaya dokunmak ve her yeni ekranda unutulma riski
demekti. Bunun yerine renkler zaten tek yerdeydi: `@theme` belirteçleri.

Koyu tema `ink` rampasını ters çevirip `surface` belirtecini koyulaştırır — bileşenlerin hiçbiri
değişmez. Tek şart: bileşen ham renk yazmaz. Bu yüzden şablonlardaki 11 `bg-white` kullanımı
`bg-surface` ile değiştirildi.

**Tercih tarayıcıda durur**, sunucuda değil: hesaba bağlı bir ayar değil, cihaza ait bir görünüm
tercihidir. İlk ziyarette işletim sisteminin tercihi (`prefers-color-scheme`) kullanılır.

**Ekran titremesi** (`flash of wrong theme`) için tema, uygulama yüklenmeden önce uygulanmalıdır.
Katı CSP satır içi script'e izin vermediğinden bu iş ayrı bir dosyadadır (`public/tema.js`).
CSP'yi gevşetmek yerine dosyayı ayırmak tercih edildi.

## 26. CSV içe aktarma tarayıcıda ayrıştırılır

Sunucu uçtan **JSON satır dizisi** bekler, ham CSV değil. Dosyayı tarayıcı okur, ayrıştırır,
normalleştirir ve kullanıcıya önizleme gösterir.

Neden: kullanıcı neyi göndereceğini **göndermeden önce** görür; hatalı satır sunucuya hiç gitmez
ve "500 satırın 3'ü bozuk" durumunda kullanıcı hangi satırın neden bozuk olduğunu tek bakışta
anlar. Ayrıca sunucuya CSV ayrıştırıcı bağımlılığı girmez.

Ayraç otomatik bulunur (Türkçe Excel `;` yazar) ve fiyat `1.299,90` biçiminden `1299.90`'a
çevrilir — ama çevrilmiş hali önizlemede gösterilir, sessizce yapılmaz.

İçe aktarılan ürünler **taslak** olarak eklenir: yanlış bir dosya 500 ürünü birden vitrine
düşürmesin.

## 27. Görsel yükleme multipart değil, ham gövde

Tek dosya için multipart hem fazladan bir ayrıştırıcı bağımlılığı (`multer`) hem de fazladan bir
saldırı yüzeyi demekti. Tarayıcı `File` nesnesini doğrudan gövdeye koyar, türü `Content-Type` ile
bildirir; sunucu `express.raw` ile okur.

Güvenlik kararları:

- **Dosya adı kullanıcıdan gelmez.** Ad sunucuda üretilir (16 rastgele bayt + allowlist'ten
  uzantı). Yol çıkışı, özel karakter ve üzerine yazma saldırılarını *temizleyerek* değil,
  girdiyi hiç kullanmayarak kapatır.
- **Tür baytlardan doğrulanır.** `Content-Type` istemcinin iddiasıdır; sihirli sayı gerçeği
  söyler. "image/png" diye gelen bir HTML dosyası reddedilir.
- **SVG kabul edilmez.** İçinde script çalışabilir; görsel ihtiyacı için gerekli değil.
- **Okurken ad yeniden denetlenir.** Yazarken kontrol etmek tek başına yetmez; depodan okuma
  ayrı bir kapıdır.
- Sunulan dosyaya `nosniff`, `Content-Disposition: inline` ve kendi `sandbox` CSP'si eklenir:
  bir şey sızsa bile tarayıcıda çalışmaz.

**Eksik kalan:** silinen ürünün görseli diskte kalır. Periyodik temizlik işi yazılmadı; disk
kullanımı zamanla artar. [SECURITY.md](SECURITY.md) içinde not edildi.

## 28. Geri dönüş yolu yedek, "down" göçü değil

Şema göçlerinin geri alınması için bir çatı (her göçün bir `down` eşi) kurulmadı. Yerine
veritabanı + görsel yedeği kuruldu: `scripts/yedek-al.js` ve `scripts/yedek-geri-yukle.js`
([YEDEKLEME.md](YEDEKLEME.md)).

Gerekçe: `down` göçleri çoğu zaman yazıldıkları gibi çalışmaz. Kolon silen bir göçün `down`'ı
kolonu geri getirir ama **içindeki veriyi getirmez**; birleştirilen iki tabloyu ayıran bir göç
geri alınırken hangi satırın nereye gittiği bilinmez. Yani `down` göçü şemayı geri alır, veriyi
değil — oysa geri dönülmesinin sebebi neredeyse her zaman veridir. Yedek ikisini birden getirir.

İkinci gerekçe: şu an **tek** göç dosyası var (`001_initial_schema.sql`), yani geri alınacak bir
şema değişikliği henüz yok. Kullanılmayan bir çatıyı şimdi yazmak, ilk gerçek göçte yanlış
çıkacak kod yazmak olurdu.

Kod tarafı rollback için ayrı araca gerek yok: üç dalın geçmişi düz, bir sürüm geri dönmek
önceki commit'i çıkarıp `docker compose up -d --build` demek.

**Bunun bedeli:** göç ileri yönde kırılırsa otomatik dönüş yok — yedekten geri yükleme elle
yapılır ve o aradaki veri gider. Kabul edildi, çünkü alternatifi çalıştığı denenmemiş bir
`down` zinciri.

## 29. Telefonda deneme HTTPS tüneliyle; yerel dönüş adresleri her zaman kayıtlı

Telefondan yerel ağ adresiyle (`http://192.168.x.x:8090`) girilemiyor ve bu bir hata değil:
PKCE `crypto.subtle` istiyor, tarayıcı onu yalnızca güvenli bağlamda veriyor. Düz HTTP'de
giriş ekranı "hazırlanıyor"da takılıyor; service worker ve "uygulamayı yükle" de aynı duvara
çarpıyor. Çözüm olarak Cloudflare hızlı tüneli seçildi ve `scripts/tunel.js` ile tek komuta
indirildi ([TELEFONDA-DENEME.md](TELEFONDA-DENEME.md)).

Kendi sertifikasını üretip (mkcert gibi) yerel HTTPS kurmak denenmedi: her telefona kök
sertifika yüklemek gerekirdi, iOS'ta bu birkaç ayar ekranı sürüyor ve kurulum bilgisayara
özel kalıyor. Tünel hiçbir şey yüklemiyor.

Tünelin bedeli adresin her açılışta değişmesi. Bu yüzden betik `PUBLIC_URL`'i kendisi yazıp
`api`'yi yeniden başlatıyor; adres elle takip edilmiyor.

**Bu kararın ortaya çıkardığı gerçek arıza** ve kalıcı düzeltmesi: `redirect_uris` listesinin
tek kaynağı `PUBLIC_URL`'di ve `upsertClient` listeyi üzerine yazıyor. `PUBLIC_URL` tünele
çevrildiği an bilgisayardan giriş "redirect_uri bu istemci için kayıtlı değil" diye kırıldı —
hata mesajı sebebi hiç söylemiyor. Artık `EXTRA_REDIRECT_URIS` var: geliştirmede
`localhost:8090` ve `localhost:5173` **her zaman** kayıtlı kalıyor, üretimde liste boş.
Boş dize "verilmedi" sayılıyor, çünkü compose tanımsız değişkeni boş geçiriyor ve `??`
buna düşmediği için ayarı compose'tan geçirmek varsayılanı sessizce silerdi.

**Bunun bedeli:** geliştirme ortamında `localhost`'a dönen iki redirect_uri kayıtlı duruyor.
Üretimde durmadığı ve açık istemcinin PKCE zorunluluğu kalktığı için kabul edildi.

## 30. Bildirimler e-postayla aynı olaydan beslenir; metin yazılırken üretilir

Site içi bildirim ve e-posta **aynı domain olayından** doğuyor: outbox'a yazılan olay
RabbitMQ'da iki ayrı kuyruğa düşüyor (`donanex.email`, `donanex.notifications`) ve her
kuyruğun kendi tüketicisi var. Tek kuyruğu iki tüketiciye paylaştırmak mesajları
BÖLERDİ — olayların yarısı e-postaya, yarısı zile giderdi. Ayrı kuyruk ayrıca kanalları
birbirinden yalıtıyor: SMTP çökmüşken zil çalışmayı sürdürüyor.

Kazancı şu: "e-posta gitti ama zilde yok" (ya da tersi) durumu yapısal olarak oluşmuyor.
Entegrasyon testi iki kanalı birlikte doğruluyor.

**Metin yazılırken üretiliyor, görüntülenirken değil.** Alternatifi olayı saklayıp her
açılışta metne çevirmekti; o zaman bir yıl önceki bildirimin metni bugünün koduna göre
değişirdi ve kullanıcı "bana bu yazmamıştı" derdi. Bedeli: metin düzeltmesi eski satırlara
yansımıyor.

**Alıcı tek eksende:** `scope` + `scope_id` (`user` / `store` / `admin`). Polimorfik olduğu
için yabancı anahtar konulamıyor — bedeli bu. Karşılığında tek indeks, tek sorgu biçimi ve
yeni alıcı türü için şema değişikliği gerekmemesi var. Bugün hiçbir akış kullanıcıyı ya da
mağazayı silmiyor (ikisi de durum alanıyla pasifleşiyor), bu yüzden eksik yabancı anahtar
şu an tutarsızlık üretmiyor.

**Tekilleştirme kuyruk yüzünden şart.** Teslim en-az-bir-kez: tüketici işledikten sonra onay
gönderemezse mesaj yeniden gelir. `(source_event_id, scope, scope_id)` üzerinde `UNIQUE …
NULLS NOT DISTINCT` kısmi indeksi var; `NULLS NOT DISTINCT` olmadan yönetim bildirimleri
(scope_id NULL) hiç tekilleşmezdi, çünkü PostgreSQL iki NULL'u varsayılan olarak farklı sayar.

**Gerçek zamanlı iletim: Redis yayınla/abone ol + SSE.** Bildirimi worker yazıyor, tarayıcıya
iten açık bağlantı API sürecinde duruyor; iki süreci Redis kanalı bağlıyor. API süreç başına
TEK abonelik kuruyor ve açık bağlantılara alıcı anahtarına göre dağıtıyor. Redis yoksa akış
ucu 503 dönüyor ve istemci dakikalık yoklamaya düşüyor — sessizce boş bir bağlantı açmak,
istemciyi "çalışıyor" sanıp hiç yoklamamaya iterdi.

İstemci tarafında `EventSource` değil `fetch` kullanılıyor: `EventSource` başlık eklemeye
izin vermiyor, erişim jetonu ise `Authorization` başlığında taşınıyor (bellekte durur,
çereze yazılmaz). Jetonu adrese koymak sunucu günlüklerine ve `Referer` başlığına jeton
düşürmek olurdu. Bedeli: yeniden bağlanmayı elle yazmak.

**Arayüzde yakalanan tuzak:** panel önce telefonda aşağıdan açılan bir tabaka olarak
yazıldı ve çalışmadı. Zil, `backdrop-blur` taşıyan yapışkan başlığın içinde duruyor; arka
plan süzgeci olan bir öğe içindeki `position: fixed` öğeler için yeni bir kapsayıcı blok
kuruyor, yani tabaka ekranın altına değil **başlığın** altına yapışıyordu. Panel her boyutta
açılır kutuya çevrildi; sarmalayıcı telefonda `static` (kapsayıcı başlık olsun, panel
sayfanın kenar boşluğuna hizalansın), `sm`'den sonra `relative` (zile hizalansın).

## 31. Panel: koyu kenar menü, elle çizilmiş grafik, uydurulmayan eğilim

Panelin görünüşü için örnek alınan şey Mosaic-lite: **koyu kenar menü, açık içerik
alanı**. Koyu menü içeriği çerçeveliyor ve gözün ilk gittiği yeri (asıl iş alanı) açık
bırakıyor. Menü `night` belirteçlerini kullanıyor; bunlar iki temada da aynı kalan
yüzeyler için tanımlı, yani koyu temada ters çevrilip beyaza dönmüyorlar.

**Grafik kütüphanesi eklenmedi.** Tek bir grafik türü için Chart.js ~200 KB paket, kendi
renk/yazı tipi sistemi ve koyu temada ayrıca ayarlanacak renkler demekti.
`CizgiGrafik.vue` elle çizilmiş SVG: renkleri tema değişkenlerinden okuyor, yani açık/koyu
geçişinde kendiliğinden doğru.

İki ayrıntı ölçümle çıktı:

- SVG yatayda esniyor (`preserveAspectRatio="none"`), bu da çizgi kalınlığını bozardı.
  `vector-effect="non-scaling-stroke"` kalınlığı her genişlikte sabit tutuyor.
- **Yazı SVG'nin içinde değil.** Esneme metni de bozardı; eksen etiketleri altta normal
  HTML. Etiketler iki kademeli: masaüstünde ikisinde biri, telefonda dörtte biri. Telefon
  kademesinde son etiketin komşusu eleniyor — onsuz 12. ve 13. gün üst üste biniyordu
  (sütun 22px, etiket 34px).

**Eğilim (trend) rozeti uydurulmuyor.** Son 7 gün / önceki 7 gün karşılaştırması AYRI BİR
SORGU DEĞİL, panonun zaten döndürdüğü on dört günlük serinin içinden hesaplanıyor. Önceki
hafta sıfırsa rozet HİÇ çizilmiyor: sıfırdan artışın yüzdesi tanımsızdır ve "%100 artış"
diye yazılsaydı yeni açılmış her mağazanın panelinde yanıltıcı biçimde parlardı.

**Seride boş günler var.** `generate_series` ile önce günler üretiliyor, veri sola
ekleniyor. Yalnızca var olan satırlar gruplansaydı sipariş alınmayan günler listeden düşer
ve grafik takvim boyunca değil "hareket olan günler" boyunca uzardı — iki sakin hafta,
yoğun bir hafta gibi görünürdü. Gün sınırı Europe/Istanbul'a göre: sunucu UTC çalışıyor ve
saat 02:00'de verilen sipariş UTC'de önceki güne düşerdi. Mağaza serisi PAKET üzerinden
sayılıyor, sipariş üzerinden değil: bir sipariş birden çok mağazaya bölünebiliyor.

**Gösterge kutuları tıklanabilir.** "4 onay bekleyen mağaza" yazan bir kutuya basmak o
listeye gitmenin en doğal yolu; önceden sayıyı görüp menüden ilgili sayfayı aramak
gerekiyordu. Süzgeç adres çubuğundan geçiyor (`?durum=pending_payment`), böylece bağlantı
paylaşılabilir kalıyor.

**Emoji kaldırıldı.** Panel menüsü, boş durum kutuları ve kenar menü emoji kullanıyordu
(📊 🏪 👥 📦 💬 ⚙️). Vitrin için daha önce yazılan gerekçe panel için de geçerliydi: emoji
her işletim sisteminde başka çiziliyor ve renk almıyor — koyu kenar menüde gri yazının
yanında rengarenk duruyorlardı. Hepsi `AppIcon` çizimlerine geçti.

## 32. Adreslerde UUID yok: mağaza kısa adı, sipariş numarası

Vitrin adresleri zaten okunurdu (`/urunler/teknoloji-deposu/msi-rtx-4060`). Kötü olan
PANEL ve HESAP adresleriydi; hepsinin ortak sebebi aynıydı: **UUID**.

```text
önce   /magaza/671907fe-7860-41a2-8915-f669f513bb38/siparisler/9b2c…
sonra  /magaza/teknoloji-deposu/siparisler/PZ-2026-001005
```

**Mağaza kısa adı istemcide çözülüyor, sunucuda değil.** API mağazayı hâlâ kimliğiyle
tanıyor; çeviriyi `lib/magaza.js` yapıyor ve bunun için ek istek atmıyor — kişinin
mağazaları kısa adlarıyla birlikte zaten `/api/me` yanıtında geliyor.

Alternatif, API'nin de kısa adı kabul etmesiydi: `/api/stores/:storeId` ucuna bir çözümleme
ara katmanı konur ve ön uç hiç değişmezdi. Seçilmedi, çünkü o ara katman **yetki
denetiminin önüne** girerdi: her panel isteği, izin sorulmadan önce fazladan bir sorgu
çalıştırırdı. Kozmetik bir kazanç için sistemin en hassas yoluna dokunmak doğru değil.

**Sipariş numarası sunucuda çözülüyor**, çünkü numara ile kimlik arasındaki bağ yalnızca
veritabanında var. Okuma uçları artık ikisini de kabul ediyor (`domain/ordering/
orderReference`): hangi sütunla eşleşileceği SQL'e açıkça iletiliyor. Tek alanda taşıyıp
"önce uuid'ye çevirmeyi dene" deseydik, numara biçimindeki metin uuid'ye çevrilirken
veritabanı hata fırlatır, kullanıcı 500 görürdü.

Numara deseni DAR: `PZ-<yıl>-<6 hane>`. Serbest metni numara sayıp veritabanına göndermek,
adres çubuğuna yazılan her şeyin sorguya dönmesi demekti; biçim denetimi sorgudan önce
çalışıp 400 dönüyor.

**Sahiplik denetimi değişmedi.** Sipariş numarası sıralı, yani tahmin edilebilir. Bu yüzden
numara yalnızca "hangi kayıt" sorusunu yanıtlıyor; "senin mi" sorusunu hâlâ kullanıcı
kimliği ya da mağaza kapsamı yanıtlıyor ve "yok" ile "senin değil" aynı yanıtı veriyor.

**Eski bağlantılar kırılmadı.** Gönderilmiş e-postalarda, bildirimlerde ve kayıtlı
sekmelerde UUID'li adresler var. Okuma uçları kimliği kabul etmeyi sürdürüyor; yönlendirici
ise panel adresindeki kimliği kısa ada çevirip adres çubuğunu `replace` ile düzeltiyor —
`push` olsaydı geri tuşu kullanıcıyı eski adrese atar, o da tekrar buraya yönlenir ve geri
tuşu çalışmaz hâle gelirdi.

**İptal gibi komutlar hâlâ yalnızca kimlik alıyor.** Okuma ucunun girdisi geniş olabilir;
geri alınamaz bir işlemin girdisi dar olmalı. Arayüz iptal isteğini adresteki değerle değil,
yüklediği siparişin kimliğiyle gönderiyor.

**Değişmeyen iki adres:** `/odeme/:orderId` (ödeme sayfasına yalnızca yönlendirmeyle
gelinir, elle yazılmaz ya da paylaşılmaz) ve ürün düzenleme `/urunler/:productId` (ürün adı
değişince kısa ad da değişir ve kayıtlı bağlantı kırılırdı).

**Emoji tamamen kalktı.** Panel menüsünden sonra hesap menüsü, boş durum kutuları, kargo
rozetleri ve "bulunamadı" sayfası da `AppIcon` çizimlerine geçti — emoji her işletim
sisteminde başka çiziliyor ve renk almıyor.
