# Telefonda deneme (HTTPS tüneli)

Projeyi telefonda açmak için yerel ağ adresi (`http://192.168.x.x:8090`)
**yetmiyor**. Sebebi tek satırda: giriş akışı PKCE kullanıyor, PKCE
`crypto.subtle.digest` istiyor, tarayıcı da `crypto.subtle`'ı yalnızca
**güvenli bağlamda** (HTTPS ya da `localhost`) veriyor. Düz HTTP'de o nesne
hiç tanımlı olmuyor, giriş ekranı "hazırlanıyor" yazısında takılıyor.

Aynı kural uygulamayı ana ekrana eklemek için de geçerli: service worker ve
"uygulamayı yükle" seçeneği de güvenli bağlam istiyor.

Çözüm telefona HTTPS üzerinden servis etmek. Aşağısı Cloudflare'in **hızlı
tüneli** ile; hesap, alan adı ve sertifika gerekmiyor.

## Bir kez: cloudflared kurulumu

```powershell
winget install --id Cloudflare.cloudflared
```

## Her denemede: tek komut

```powershell
node scripts/tunel.js
```

Betik sırayla şunları yapıyor:

1. Yığının hazır olmasını bekliyor; ayakta değilse `docker compose up -d`
   ile kendisi başlatıyor (Docker Desktop açılışta yavaş geldiği için en
   fazla 5 dakika bekliyor).
2. Tüneli açıyor ve verdiği adresi okuyor.
3. `.env` içindeki `PUBLIC_URL`'i o adrese çeviriyor — yalnızca o satıra
   dokunuyor, dosyanın geri kalanına değil.
4. `api` ve `worker`'ı yeniden başlatıyor.
5. Adresi ekrana basıyor ve `.tunel/adres.txt` dosyasına yazıyor.

Telefonda o adresi aç, giriş yap. Ana ekrana eklemek için tarayıcı menüsünden
"Uygulamayı yükle" / "Ana ekrana ekle".

**Ctrl+C** ile kapatıldığında `PUBLIC_URL` kendiliğinden yerel adrese dönüyor
ve `api` yeniden başlıyor. Yani deneme sonrası elle temizlik gerekmiyor.

Tünel süreci dışarıdan kapandıysa ayarları şu komut yerele döndürüyor:

```powershell
node scripts/tunel.js --kapat
```

## Dönüş adresi (redirect_uri) neden elle eklenmiyor

`oauth_clients.redirect_uris` listesini `api` her açılışta `PUBLIC_URL`'den
kendisi üretiyor (`backend/src/bootstrap/syncOAuthClients.ts`). Bu liste
**üzerine yazılıyor**, eklenmiyor; dolayısıyla veritabanına elle eklenen bir
adres bir sonraki açılışta sessizce kayboluyor. Betiğin veritabanına hiç
dokunmamasının sebebi bu.

Aynı dosya, `PUBLIC_URL` tünele çevrildiğinde **yerel adresleri de kayıtlı
tutuyor** (`EXTRA_REDIRECT_URIS`, geliştirmede varsayılan olarak
`localhost:8090` ve `localhost:5173`). Bu olmadığında tünel açıkken
bilgisayardan giriş yapmak "redirect_uri bu istemci için kayıtlı değil"
hatasıyla kırılıyordu. `WEB_PORT`'u değiştirdiysen `EXTRA_REDIRECT_URIS`'i
elle vermen gerekir: `api` konteyneri compose'un yayın portunu görmüyor.

## Tünel açıkken bilgisayardan giriş

Çalışıyor, ama giriş adımı **tünel adresi üzerinden** dönüyor: `PUBLIC_URL`
aynı zamanda jetonların `iss` alanı ve OIDC uç noktalarının adresi, yani
kimlik sağlayıcının adresi o anda tünel. Tarayıcı kısa süre
`trycloudflare.com` adresinde görünüp `localhost:8090`'a geri dönüyor. Bu
beklenen davranış, hata değil.

## Açılışta otomatik başlatma

`Donanex-Tunel` adlı görev, oturum açıldıktan 30 saniye sonra betiği çalıştırıyor.
Betik Docker'ı beklediği için bu gecikme yalnızca açılış kalabalığını azaltmak
için var.

### Görevin iki ayarı neden böyle

**`StopOnIdleEnd` kapalı.** Windows'un varsayılanı bunu AÇIK bırakıyor ve
bilgisayar boşta kalmayı bıraktığında görevi durduruyor. Tünel saatlerce açık
kalacağı için bu ayar betiği birkaç saniye içinde Ctrl+C ile öldürüyordu;
`LastTaskResult` 0xC000013A (CONTROL_C_EXIT) oluyor, `cloudflared` yetim
kalıyor ve adres birden cevap vermez oluyordu. Hata mesajı yoktu: görev
"Ready" görünüyor, sanki düzgün bitmiş gibi.

Yetim kalan tünel ayrıca `services.exe` altına geçiyor ve yönetici yetkisi
olmadan kapatılamıyor. Bilgisayar yeniden başlayınca gidiyor.

**`ExecutionTimeLimit` sıfır**, yani sınırsız. Varsayılan 3 gün; tünelin
günlerce açık kalması olağan.

Görev `node.exe`'yi doğrudan çalıştırıyor, araya `powershell` sarmalayıcısı
koymuyor. Bedeli: görev çalışırken bir konsol penceresi açık duruyor. O
pencereyi kapatmak tüneli de kapatır.

Görev kaybolursa yeniden kaydetmek için (proje kökünde çalıştırın):

```powershell
$proje = (Get-Location).Path; $node = (Get-Command node).Source; $eylem = New-ScheduledTaskAction -Execute $node -Argument "scripts/tunel.js" -WorkingDirectory $proje; $tetik = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN$env:USERNAME"; $tetik.Delay = "PT30S"; $ayar = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -DontStopOnIdleEnd -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1); Register-ScheduledTask -TaskName "Donanex-Tunel" -Action $eylem -Trigger $tetik -Settings $ayar -RunLevel Limited -Force
```

Durumu görmek, elle çalıştırmak, durdurmak ve kaldırmak:

```powershell
Get-ScheduledTaskInfo -TaskName Donanex-Tunel
```

```powershell
Start-ScheduledTask -TaskName Donanex-Tunel
```

```powershell
Stop-ScheduledTask -TaskName Donanex-Tunel
```

```powershell
Unregister-ScheduledTask -TaskName Donanex-Tunel -Confirm:$false
```

O anki adres `.tunel/adres.txt` dosyasında duruyor:

```powershell
Get-Content .tuneladres.txt
```

Görev `.tunel/tunel.log` dosyasına yazıyor; bir şey ters giderse oraya bakın.

## Bunun kalıcı çözüm olmadığı yer

Hızlı tünel adresi **her açılışta değişiyor**. Betik `PUBLIC_URL`'i kendisi
güncellediği için giriş her seferinde çalışıyor, ama:

- Telefonda ana ekrana eklenen kısayol eski adrese bakar ve bozulur; her
  açılışta yeni adresi açmak gerekir.
- Adresi telefona elle yazmak gerekir.

Gerçek bir alan adı alındığında bu sorun tümden kalkıyor: `PUBLIC_URL` bir kez
yazılır, `redirect_uris` bir kez üretilir, telefondaki kısayol hep çalışır.
Cloudflare'in tünel hizmeti o kurulumda da ücretsiz; ücretli olan tek şey
alan adının kendisi.

Tünel klasörü (`.tunel/`) günlük ve adres dosyası tutuyor, `.gitignore`'da.
