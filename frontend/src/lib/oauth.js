/**
 * OAuth 2.1 yetkilendirme kodu akışı — tarayıcı tarafı.
 *
 * Uygulama "açık istemci"dir: parola saklayamaz. Bunun yerine her girişte tek
 * kullanımlık bir doğrulayıcı (code_verifier) üretilir, özeti sunucuya gönderilir
 * ve jeton alınırken aslı kanıt olarak sunulur (PKCE). Yetkilendirme kodu
 * çalınsa bile doğrulayıcı olmadan jetona çevrilemez.
 */
const CLIENT_ID = "pazar-web";
const STORAGE_KEY = "pazar.oauth";
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

export async function startLogin(options) {
  window.location.assign(await buildAuthorizeUrl(options));
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
