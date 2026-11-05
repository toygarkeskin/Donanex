"use strict";

/**
 * Application katmanının dış dünyadan beklediği sözleşmeler (Clean Architecture "port"ları).
 * Somut sınıflar infrastructure altındadır; composition root (bootstrap/container.js)
 * başlangıçta her adaptörün buradaki metotları sağladığını assertPorts ile doğrular.
 *
 * Komut tarafı yalnızca unitOfWork'ü, sorgu tarafı yalnızca read model'leri kullanır.
 */
const PORTS = Object.freeze({
  /* ----- Yazma tarafı ----- */
  // run(async (repos) => ...): tek transaction içinde
  // repos.products | orders | customers | support | sessions verir.
  unitOfWork: ["run"],

  /* ----- Okuma tarafı ----- */
  productReadModel: ["listForStore", "listCategories", "listForAdmin"],
  orderReadModel: ["getPaymentSummary", "findForTracking", "listForCustomer", "listForAdmin", "getStats"],
  customerReadModel: ["getProfile", "getAddress", "getSessionVersion"],
  supportReadModel: ["list", "get"],
  sessionReadModel: ["isRevoked"],
  healthReadModel: ["ping"],

  /* ----- Servisler ----- */
  passwordHasher: ["hash", "verify", "verifyDummy", "needsRehash"],
  tokenService: ["issue", "verify"],
  opaqueTokens: ["generate", "hash", "isWellFormed"],
  mailer: ["send"],
  safeEqual: null // (a, b) => boolean
});

function assertPorts(services) {
  for (const [port, methods] of Object.entries(PORTS)) {
    const adapter = services[port];
    if (!adapter) throw new Error(`Port bağlanmamış: ${port}`);
    if (methods === null && typeof adapter !== "function") {
      throw new Error(`Port bir fonksiyon olmalı: ${port}`);
    }
    for (const method of methods || []) {
      if (typeof adapter[method] !== "function") {
        throw new Error(`${port} portu "${method}" metodunu sağlamıyor.`);
      }
    }
  }
}

module.exports = { PORTS, assertPorts };
