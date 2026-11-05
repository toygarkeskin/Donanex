const currency = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" });
const dateTime = new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" });

export const money = (value) => currency.format(Number(value) || 0);

export function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : dateTime.format(date);
}

/** Yalnızca http/https bağlantısını döndürür; aksi halde boş metin. */
export function safeHttpUrl(value) {
  try {
    const url = new URL(String(value));
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}
