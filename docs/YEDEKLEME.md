# Yedekleme ve geri dönüş

Veri iki ayrı yerde duruyor ve ikisi de kaybolabilir:

| Ne | Nerede | Kaybedilirse |
| --- | --- | --- |
| Veritabanı | `db-data` volume'u | Ürünler, siparişler, kullanıcılar, destek talepleri |
| Yüklenen görseller | `uploads` volume'u | Ürün fotoğrafları (veritabanındaki yollar boşa çıkar) |

Bu yüzden yedek iki dosya hâlinde alınıyor. Yalnızca veritabanını yedeklemek,
geri dönüldüğünde **ürünleri olup fotoğrafları olmayan** bir katalog bırakırdı.

## Yedek almak

```bash
node scripts/yedek-al.js
```

`yedekler/` altına iki dosya yazar:

```
yedekler/donanex-2026-11-08T21-13-15.sql.gz             # veritabanı dökümü
yedekler/donanex-2026-11-08T21-13-15-gorseller.tar.gz   # uploads volume'u
```

`pg_dump` konteynerin **içinde** çalışır; kullanıcı adını ve veritabanı adını
oradaki ortam değişkenlerinden okur, böylece `.env` bilgisayarda okunmaz.

Varsayılan olarak en yeni **7** yedek tutulur, eskiler silinir (disk dolmasın).
Değiştirmek için: `node scripts/yedek-al.js --sakla 14`

`yedekler/` klasörü `.gitignore`'da — yedekler gerçek veri içerir, depoya girmez.

## Yedeği denemek (önerilen)

Denenmemiş yedek, yedek sayılmaz. Bu komut yedeği **ayrı** bir veritabanına
yükler, içindekileri sayar ve o veritabanını siler. Canlı veriye dokunmaz:

```bash
node scripts/yedek-geri-yukle.js --deneme
```

```
Yedek: yedekler\donanex-2026-11-08T21-13-15.sql.gz (0.20 MB açılmış)
Deneme başarılı. Yedekteki içerik:
  urun=33 siparis=5 kullanici=9
Deneme veritabanı silindi. Canlı veriye dokunulmadı.
```

Çıkan sayılar canlı sistemdekilerle aynı olmalı.

## Gerçekten geri dönmek

**Bu işlem veri siler:** hedef veritabanının şeması düşürülür ve yedekteki
hâliyle yeniden kurulur. Yedekten sonra girilen her şey gider. Bu yüzden
`--onayla` olmadan çalışmaz:

```bash
node scripts/yedek-geri-yukle.js yedekler/donanex-2026-11-08T21-13-15.sql.gz --onayla
```

Görseller ayrı dosyada; **aynı damgalı** tarball'ı da açmak gerekir:

```bash
docker compose exec -T api sh -c 'tar -xz -C /app/var' < yedekler/donanex-2026-11-08T21-13-15-gorseller.tar.gz
```

Geri yükledikten sonra API'yi yeniden başlatın (önbellek eski veriyi tutuyor olabilir):

```bash
docker compose restart api
```

## Düzenli çalıştırmak

Elle alınan yedek, alınmayı unutulan yedektir. Windows'ta Görev Zamanlayıcı
(Task Scheduler) ile günlük bir görev:

```
Program : node
Bağımsız değişkenler : scripts/yedek-al.js
Başlangıç konumu : <proje klasörü>
```

Linux sunucuda crontab ile her gece 03:00:

```
0 3 * * * cd /srv/donanex && /usr/bin/node scripts/yedek-al.js >> /var/log/donanex-yedek.log 2>&1
```

## Bunun kapsamadığı şey

Yedekler **aynı makinede** duruyor. Disk ölürse yedekler de ölür. Gerçek
kullanımda `yedekler/` klasörünün başka bir yere (harici disk, nesne depolama,
başka sunucu) kopyalanması gerekir — bu betikler onu yapmaz, çünkü nereye
kopyalanacağı dağıtım kararı.

## Sürüm geri alma (rollback)

Kod tarafında ayrı bir araç yok, gerek de yok: üç dalın (`test` → `uat` →
`main`) geçmişi düz, yani bir sürüm geri dönmek önceki commit'i çıkarıp
yeniden kurmak demek:

```bash
git checkout <önceki-commit>
docker compose up -d --build
```

Veritabanı şeması tarafında tek bir göç dosyası var
(`001_initial_schema.sql`), yani geri alınacak şema değişikliği yok. Şema
değiştiren bir göç eklendiğinde geri dönüş yolu, yukarıdaki veritabanı
yedeğidir — "down" göçü yazmak değil. Down göçleri çoğu zaman yazıldıkları
gibi çalışmaz (silinen bir kolonun verisi geri gelmez), yedek ise gelir.
