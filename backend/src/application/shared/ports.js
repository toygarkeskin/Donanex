"use strict";

/**
 * Application katmanının dış dünyadan beklediği sözleşmeler — Clean Architecture
 * "port"ları. Somut sınıflar infrastructure altındadır ve YALNIZCA composition
 * root'ta (bootstrap/container.js) bağlanır.
 *
 * Bağımlılığın yönü içeri doğrudur: application bu dosyadaki isimleri bilir,
 * hangi veritabanının ya da kuyruk sisteminin kullanıldığını bilmez.
 *
 * assertPorts, sistem açılırken her adaptörün sözleşmeyi karşıladığını doğrular;
 * eksik bir metot ilk istekte değil, açılışta yakalanır.
 */
const PORTS = Object.freeze({
  /* ---------- Yazma tarafı (Command) ---------- */
  // run(async (repos) => ...) tek transaction içinde tüm repository'leri verir
  unitOfWork: ["run"],

  /* ---------- Okuma tarafı (Query) ---------- */
  catalogReadModel: ["listProducts", "getProductBySlug", "listCategories", "listStoreProducts", "getProductForStore"],
  storeReadModel: ["getBySlug", "listPublic", "listForAdmin", "getForMember", "listMembers", "listForMember"],
  cartReadModel: ["getLines", "findCartId"],
  orderReadModel: [
    "listForUser",
    "getForUser",
    "getByTrackingCode",
    "listForStore",
    "getForStore",
    "listForAdmin",
    "getForAdmin"
  ],
  userReadModel: ["getProfile", "listForAdmin", "getAccessPolicy", "getSessionVersion", "listAddresses"],
  supportReadModel: ["listForUser", "listForStore", "listForAdmin", "get"],
  dashboardReadModel: ["adminSummary", "storeSummary"],
  healthReadModel: ["ping"],

  /* ---------- Güvenlik ---------- */
  // issueAccessToken / issueIdToken: imzalı JWT üretir, verifyAccessToken doğrular
  tokenIssuer: ["issueAccessToken", "issueIdToken", "verifyAccessToken", "jwks"],
  // Tahmin edilemez tek kullanımlık kodlar; veritabanında yalnızca özeti tutulur
  opaqueTokens: ["generate", "hash", "isWellFormed"],
  passwordHasher: ["hash", "verify", "verifyDummy", "needsRehash"],
  // PKCE doğrulaması (S256); açık istemcide çalınan yetkilendirme kodunu işe yaramaz kılar
  pkce: ["verify"],
  safeEqual: null,

  /* ---------- Altyapı servisleri ---------- */
  cache: ["get", "set", "delete", "deleteByPrefix"],
  mailer: ["send"],
  clock: ["now"],
  ids: ["uuid"],
  logger: ["debug", "info", "warn", "error"]
});

function assertPorts(services) {
  const missing = [];
  for (const [port, methods] of Object.entries(PORTS)) {
    const adapter = services[port];
    if (adapter === undefined || adapter === null) {
      missing.push(`${port}: bağlanmamış`);
      continue;
    }
    if (methods === null) {
      if (typeof adapter !== "function") missing.push(`${port}: fonksiyon olmalı`);
      continue;
    }
    for (const method of methods) {
      if (typeof adapter[method] !== "function") missing.push(`${port}.${method}(): eksik`);
    }
  }
  if (missing.length) {
    throw new Error(`Port sözleşmesi karşılanmıyor:\n - ${missing.join("\n - ")}`);
  }
}

module.exports = { PORTS, assertPorts };
