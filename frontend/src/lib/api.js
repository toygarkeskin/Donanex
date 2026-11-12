/**
 * Tek HTTP istemcisi.
 *
 * Erişim jetonu BELLEKTE tutulur (Pinia), tarayıcı deposuna yazılmaz: böylece
 * bir XSS açığı jetonu kalıcı olarak çalamaz. Jeton süresi dolduğunda istemci
 * sessizce yeniler (yenileme jetonu HttpOnly çerezdedir) ve isteği bir kez
 * tekrarlar; kullanıcı bunu fark etmez.
 */
const BASE = import.meta.env.VITE_API_BASE || "/api";

export class ApiError extends Error {
  constructor(message, status, code, details) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

let accessToken = null;
let onUnauthorized = () => {};
let refreshing = null;

export const setAccessToken = (token) => {
  accessToken = token;
};
export const getAccessToken = () => accessToken;
export const setUnauthorizedHandler = (handler) => {
  onUnauthorized = handler;
};

/**
 * Yenileme isteği aynı anda birden çok kez gönderilmez: ilk çağrı sözü
 * paylaşır. Aksi halde eş zamanlı 401 yanıtları jeton zincirini bozardı —
 * sunucu tekrar kullanımı hırsızlık sayıp oturumu tamamen kapatır.
 */
export async function refreshAccessToken() {
  if (refreshing) return refreshing;

  refreshing = (async () => {
    try {
      const response = await fetch("/oauth/token", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "refresh_token", client_id: "donanex-web" })
      });
      if (!response.ok) return null;
      const data = await response.json();
      accessToken = data.access_token;
      return accessToken;
    } catch {
      return null;
    } finally {
      refreshing = null;
    }
  })();

  return refreshing;
}

async function send(path, { method = "GET", body, raw, headers = {} } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    credentials: "same-origin",
    headers: {
      // "raw" gövdede Content-Type çağıran tarafından verilir (dosyanın türü).
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers
    },
    body: raw !== undefined ? raw : body === undefined ? undefined : JSON.stringify(body)
  });

  if (response.status === 204) return null;

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(data.message || "Beklenmeyen bir hata oluştu.", response.status, data.error, data.details);
  }
  return data;
}

export async function api(path, options = {}) {
  try {
    return await send(path, options);
  } catch (error) {
    const expired = error instanceof ApiError && error.status === 401;
    if (!expired || options.retried) {
      if (expired) onUnauthorized();
      throw error;
    }

    const token = await refreshAccessToken();
    if (!token) {
      onUnauthorized();
      throw error;
    }
    return send(path, { ...options, retried: true });
  }
}

api.get = (path, options) => api(path, { ...options, method: "GET" });
api.post = (path, body, options) => api(path, { ...options, method: "POST", body: body ?? {} });
/*
 * Dosyayı HAM gövde olarak gönderir (multipart değil). Sunucu tek dosya
 * beklediği için multipart'a gerek yok; File nesnesi doğrudan gövdeye konur
 * ve türü Content-Type başlığıyla bildirilir.
 */
api.upload = (path, file) => api(path, { method: "POST", raw: file, headers: { "Content-Type": file.type } });
/*
 * Dosya ADIYLA birlikte yükleme (talep ekleri).
 *
 * Ham gövdede dosyanın adı taşınamıyor; "X-Dosya-Adi" başlığında URL kodlu
 * gidiyor. Başlıklar yalnızca ASCII taşıyabildiği için kodlama şart —
 * "Fatura_Şubat.pdf" kodlanmadan gönderilse istek tarayıcıda reddedilirdi.
 */
api.uploadNamed = (path, file) =>
  api(path, {
    method: "POST",
    raw: file,
    headers: { "Content-Type": file.type, "X-Dosya-Adi": encodeURIComponent(file.name) }
  });

/**
 * Korumalı bir dosyayı indirir (talep ekleri).
 *
 * Neden <a href> değil: erişim jetonu bellekte, çerezde değil. Düz bir bağlantı
 * jetonsuz gider ve 401 alır. Dosya burada jetonla çekiliyor, tarayıcıya geçici
 * bir adresle (blob:) veriliyor ve adres hemen geri bırakılıyor.
 */
api.download = async (path, fileName) => {
  const getir = (token) =>
    fetch(`${BASE}${path}`, {
      credentials: "same-origin",
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });

  let yanit = await getir(accessToken);
  if (yanit.status === 401) {
    const yeni = await refreshAccessToken();
    if (yeni) yanit = await getir(yeni);
  }
  if (!yanit.ok) {
    const data = await yanit.json().catch(() => ({}));
    throw new ApiError(data.message || "Dosya indirilemedi.", yanit.status, data.error);
  }

  const adres = URL.createObjectURL(await yanit.blob());
  const baglanti = document.createElement("a");
  baglanti.href = adres;
  baglanti.download = fileName;
  document.body.appendChild(baglanti);
  baglanti.click();
  baglanti.remove();
  // Tarayıcı indirmeyi başlatana kadar adres yaşasın, sonra bellek geri alınsın.
  setTimeout(() => URL.revokeObjectURL(adres), 30_000);
};

api.put = (path, body, options) => api(path, { ...options, method: "PUT", body: body ?? {} });
api.patch = (path, body, options) => api(path, { ...options, method: "PATCH", body: body ?? {} });
api.delete = (path, options) => api(path, { ...options, method: "DELETE" });

/** Sorgu dizesi kurar; boş değerler atlanır. */
export function query(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== "") search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}
