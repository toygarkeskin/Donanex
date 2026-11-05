import { readJson, writeJson } from "./storage.js";

const KEY = "siparisErisimi";

/** Sipariş numarası + takip kodu: bu sekme kapanana kadar saklanır, sunucuda yalnızca özeti vardır. */
export function rememberOrder(orderId, trackingCode) {
  writeJson(KEY, { orderId: String(orderId), trackingCode }, sessionStorage);
}

export function recallOrder() {
  const value = readJson(KEY, null, sessionStorage);
  return value && typeof value.trackingCode === "string" ? value : null;
}
