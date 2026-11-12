"use strict";

/**
 * Application katmanının dış dünyadan beklediği sözleşmeler — Clean Architecture
 * "port"ları. Somut sınıflar infrastructure altındadır ve YALNIZCA composition
 * root'ta (bootstrap/container) bağlanır.
 *
 * Bağımlılığın yönü içeri doğrudur: application bu dosyadaki isimleri bilir,
 * hangi veritabanının ya da kuyruk sisteminin kullanıldığını bilmez.
 *
 * assertPorts, sistem açılırken her adaptörün sözleşmeyi karşıladığını doğrular;
 * eksik bir metot ilk istekte değil, açılışta yakalanır.
 */
export const PORTS = {
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
  supportReadModel: ["listForUser", "listForStore", "listForAdmin", "get", "getAttachment"],
  notificationReadModel: ["list", "countUnread"],
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
  // Yüklenen ürün görselleri; ad sunucuda üretilir, tür baytlardan doğrulanır
  fileStorage: ["save", "read"],
  // Talep ekleri; herkese açık görsellerden ayrı klasörde, yetkiyle sunulur
  attachmentStorage: ["save", "read", "remove"],
  clock: ["now"],
  ids: ["uuid"],
  logger: ["debug", "info", "warn", "error"]
} as const satisfies Record<string, readonly string[] | null>;

/** Bağlanması gereken port adları. */
export type PortName = keyof typeof PORTS;

/**
 * Composition root'un ürettiği servis torbası.
 *
 * Şeklin kendisi contracts.ts'te tanımlı; burada yalnızca yeniden dışa
 * açılıyor ki port adlarını arayan okuyucu iki dosya arasında kaybolmasın.
 */
export type { Services } from "./contracts";

import type { Services as BoundServices } from "./contracts";

export function assertPorts(services: BoundServices): void {
  const missing: string[] = [];
  // Ad ile erişim gerekiyor: PORTS listesi üzerinde dönüyoruz, tek tek
  // alan yazmıyoruz. Tipli arayüzü dizine çevirmek bunun bedeli.
  const bag = services as unknown as Record<string, unknown>;
  for (const [port, methods] of Object.entries(PORTS) as [PortName, readonly string[] | null][]) {
    const adapter = bag[port];
    if (adapter === undefined || adapter === null) {
      missing.push(`${port}: bağlanmamış`);
      continue;
    }
    if (methods === null) {
      if (typeof adapter !== "function") missing.push(`${port}: fonksiyon olmalı`);
      continue;
    }
    for (const method of methods) {
      if (typeof (adapter as Record<string, unknown>)[method] !== "function") {
        missing.push(`${port}.${method}(): eksik`);
      }
    }
  }
  if (missing.length) {
    throw new Error(`Port sözleşmesi karşılanmıyor:\n - ${missing.join("\n - ")}`);
  }
}
