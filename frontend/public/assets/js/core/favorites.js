import { readJson, writeJson } from "./storage.js";

const KEY = "favoriler.v1";

export function getFavorites() {
  const ids = readJson(KEY, []);
  return Array.isArray(ids) ? ids.filter((id) => Number.isInteger(id) && id > 0) : [];
}

export const isFavorite = (id) => getFavorites().includes(id);

/** Favori durumunu çevirir, yeni durumu döndürür. */
export function toggleFavorite(id) {
  const ids = getFavorites();
  const next = ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];
  writeJson(KEY, next);
  return next.includes(id);
}
