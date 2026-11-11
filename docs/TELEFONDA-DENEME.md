# Telefonda deneme (HTTPS tüneli)

Projeyi telefonda açmak için yerel ağ adresi (`http://192.168.x.x:8090`)
**yetmiyor**. Sebebi tek bir satırda: giriş akışı PKCE kullanıyor, PKCE
`crypto.subtle.digest` istiyor, tarayıcı da `crypto.subtle`'ı yalnızca
**güvenli bağlamda** (HTTPS ya da `localhost`) veriyor. Düz HTTP'de o nesne
hiç tanımlı olmuyor, giriş ekranı "hazırlanıyor" yazısında takılıyor.

Aynı kural uygulamayı ana ekrana eklemek için de geçerli: service worker ve
"uygulamayı yükle" seçeneği de güvenli bağlam istiyor.

Çözüm: telefona HTTPS üzerinden servis etmek. Aşağısı Cloudflare'in **hızlı
tüneli** ile; hesap, alan adı ve sertifika gerekmiyor.

## Bir kez: cloudflared kurulumu

```powershell
winget install --id Cloudflare.cloudflared
```

## Her denemede

1. Yığın ayakta olsun:

   ```powershell
   docker compose up -d
   ```

2. Tüneli aç (pencere açık kalmalı):

   ```powershell
   & "C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --url http://localhost:8090 --no-autoupdate
   ```

   Çıktıda `https://<rastgele-kelimeler>.trycloudflare.com` adresi görünür.
   **Bu adres her açılışta değişir** — hızlı tünelin doğası böyle.

3. `.env` içindeki `PUBLIC_URL` o adres olsun:

   ```
   PUBLIC_URL=https://<rastgele-kelimeler>.trycloudflare.com
   ```

   Bu değer OIDC `issuer` ve uç nokta adreslerini üretiyor; eski adres kalırsa
   tarayıcı jetonu yanlış issuer diye reddeder.

4. Aynı adresin geri dönüş yolu OAuth istemcisine eklenmeli — kayıtlı olmayan
   bir `redirect_uri` reddedilir:

   ```powershell
   docker compose exec -T db sh -c "psql -U `$POSTGRES_USER -d `$POSTGRES_DB -c `"UPDATE oauth_clients SET redirect_uris = array_append(redirect_uris, 'https://<rastgele-kelimeler>.trycloudflare.com/auth/callback') WHERE NOT ('https://<rastgele-kelimeler>.trycloudflare.com/auth/callback' = ANY(redirect_uris));`""
   ```

5. API ve worker yeni `PUBLIC_URL` ile yeniden başlasın:

   ```powershell
   docker compose up -d --force-recreate api worker
   ```

6. Doğrulama — issuer tünel adresini söylüyor mu:

   ```powershell
   curl https://<rastgele-kelimeler>.trycloudflare.com/.well-known/openid-configuration
   ```

Telefonda o adresi aç, giriş yap. Ana ekrana eklemek için tarayıcı menüsünden
"Uygulamayı yükle" / "Ana ekrana ekle".

## Denemeden sonra geri alma

Tünel penceresini kapat ve `.env` içindeki `PUBLIC_URL`'i yerel değerine
döndür (`http://localhost:8090`), sonra `docker compose up -d --force-recreate
api worker`. Eklenen `redirect_uri` satırı kalırsa zararı yok; artık var
olmayan bir adrese işaret eder. Yine de temizlemek için:

```powershell
docker compose exec -T db sh -c "psql -U `$POSTGRES_USER -d `$POSTGRES_DB -c `"UPDATE oauth_clients SET redirect_uris = ARRAY(SELECT u FROM unnest(redirect_uris) u WHERE u NOT LIKE '%trycloudflare.com%');`""
```

## Bunun kalıcı çözüm olmadığı yer

Hızlı tünel adresi her açılışta değişiyor, yani her denemede 3–5. adımları
tekrarlamak gerekiyor. Gerçek bir alan adı alındığında bu dosyanın yerini
sabit bir `PUBLIC_URL` ve gerçek bir sertifika alır; o zaman `redirect_uris`
bir kez yazılır ve bir daha dokunulmaz.

Tünel klasörü (`.tunel/`) günlük dosyası tutuyor ve `.gitignore`'da.
