/** Gizli modda veya engellenmiş depolamada sayfa kırılmasın. */
export function readJson(key, fallback, area = localStorage) {
  try {
    const value = JSON.parse(area.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

export function writeJson(key, value, area = localStorage) {
  try {
    area.setItem(key, JSON.stringify(value));
  } catch {
    /* depolama yoksa yok say */
  }
}
