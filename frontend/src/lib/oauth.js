/**
 * OAuth 2.1 yetkilendirme kodu akışı — tarayıcı tarafı.
 *
 * Uygulama "açık istemci"dir: parola saklayamaz. Bunun yerine her girişte tek
 * kullanımlık bir doğrulayıcı (code_verifier) üretilir, özeti sunucuya gönderilir
 * ve jeton alınırken aslı kanıt olarak sunulur (PKCE). Yetkilendirme kodu
 * çalınsa bile doğrulayıcı olmadan jetona çevrilemez.
 */
const CLIENT_ID = "donanex-web";
const STORAGE_KEY = "donanex.oauth";
const SCOPES = "openid profile email shop store:manage admin";

const base64url = (bytes) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const randomString = (length) => base64url(crypto.getRandomValues(new Uint8Array(length)));

async function challengeFor(verifier) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
}

export const redirectUri = () => `${window.location.origin}/auth/callback`;

/**
 * Yetkilendirme adresini kurar ve doğrulayıcıyı geçici olarak saklar.
 * sessionStorage kullanılır: yalnızca bu sekmede yaşar, kapanınca silinir.
 */
export async function buildAuthorizeUrl({ returnTo = "/" } = {}) {
  const verifier = randomString(48);
  const state = randomString(16);

  sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ verifier, state, returnTo }));

  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: redirectUri(),
    scope: SCOPES,
    state,
    code_challenge: await challengeFor(verifier),
    code_challenge_method: "S256"
  });
  return `/oauth/authorize?${params}`;
}

/**
 * Girişi başlatır. `replace`: bulunulan adres geçmişten silinir. Giriş
 * sayfası kendiliğinden akışı başlattığında bu şart; yoksa geri tuşu
 * kullanıcıyı `/giris`'e döndürüyor, o sayfa akışı yeniden başlatıp
 * kullanıcıyı tekrar ileri atıyordu (önbellekten açılınca da "Giriş ekranı
 * hazırlanıyor…"da takılıyordu). Geri tuşu artık girişten önceki sayfaya gider.
 */
export async function startLogin({ replace = false, ...options } = {}) {
  const url = await buildAuthorizeUrl(options);
  if (replace) window.location.replace(url);
  else window.location.assign(url);
}

/** Bekleyen girişin dönüş adresi (yeni istek açılırken korunur). */
export function pendingReturnTo() {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "{}").returnTo || "/";
  } catch {
    return "/";
  }
}

/**
 * Süresi dolmuş giriş isteğinin yerine sayfadan ayrılmadan yenisini açar.
 *
 * /oauth/authorize `Accept: application/json` ile çağrılınca 302 yerine
 * gideceği adresi gövdede veriyor. Giriş gerekiyorsa adres `/giris?auth=…`
 * olur: yeni istek kimliği döner ve adres çubuğu sessizce güncellenir
 * (kullanıcının yazdığı e-posta, parola ve kod yerinde kalır). Tarayıcıda
 * zaten açık bir oturum varsa adres doğrudan geri dönüş adresidir; o zaman
 * oraya gidilir ve `null` döner.
 */
export async function renewAuthRequest() {
  const url = await buildAuthorizeUrl({ returnTo: pendingReturnTo() });
  const response = await fetch(url, { credentials: "same-origin", headers: { Accept: "application/json" } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.redirectTo) throw new Error(data.error_description || "Giriş başlatılamadı. Sayfayı yenileyin.");

  const hedef = new URL(data.redirectTo, window.location.origin);
  const yeni = hedef.searchParams.get("auth");
  if (hedef.origin === window.location.origin && hedef.pathname === "/giris" && yeni) {
    const adres = new URL(window.location.href);
    adres.searchParams.set("auth", yeni);
    window.history.replaceState(window.history.state, "", adres.pathname + adres.search + adres.hash);
    return yeni;
  }
  window.location.assign(data.redirectTo);
  return null;
}

/** Hata, bekleyen giriş isteğinin süresinin dolmasından mı? */
export const isAuthRequestExpired = (error) => error?.details?.reason === "auth_request_expired";

/**
 * Tarayıcı sayfayı geri/ileri önbelleğinden (bfcache) açtıysa yeniden yükler.
 * Giriş sayfaları tek kullanımlık durum taşıyor (istek kimliği, gönderiliyor
 * bayrağı); dondurulmuş hâliyle gösterilirse takılı kalıyor.
 */
export function reloadWhenRestoredFromCache() {
  const dinleyici = (olay) => {
    if (olay.persisted) window.location.reload();
  };
  window.addEventListener("pageshow", dinleyici);
  return () => window.removeEventListener("pageshow", dinleyici);
}

/** Geri dönüş adresindeki kodu jetona çevirir. */
export async function exchangeCode({ code, state }) {
  const saved = sessionStorage.getItem(STORAGE_KEY);
  sessionStorage.removeItem(STORAGE_KEY);
  if (!saved) throw new Error("Giriş isteği bulunamadı. Lütfen baştan deneyin.");

  const pending = JSON.parse(saved);
  // state karşılaştırması: başka bir sekmeden ya da siteden gelen kod kabul edilmez.
  if (pending.state !== state) throw new Error("Giriş doğrulaması başarısız. Lütfen baştan deneyin.");

  const response = await fetch("/oauth/token", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(),
      client_id: CLIENT_ID,
      code_verifier: pending.verifier
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error_description || "Giriş tamamlanamadı.");

  return { accessToken: data.access_token, returnTo: pending.returnTo || "/" };
}

/** Giriş formunun bekleyen OAuth isteğini tamamlaması için. */
export const pendingAuthRequestId = () => new URLSearchParams(window.location.search).get("auth");
