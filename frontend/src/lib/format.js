const currency = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" });
const dateTime = new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" });
const dateOnly = new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" });

/** Sunucu parayı { cents, amount, currency } nesnesi olarak döndürür. */
export function money(value) {
  if (value === null || value === undefined) return "—";
  const cents = typeof value === "object" ? value.cents : value;
  return currency.format(Number(cents || 0) / 100);
}

/** Form alanlarında kullanılacak düz sayı (ör. 199.90). */
export const toAmount = (value) =>
  value && typeof value === "object" ? (Number(value.cents || 0) / 100).toFixed(2) : "";

export function formatDate(value, withTime = true) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return (withTime ? dateTime : dateOnly).format(date);
}

const geceli = new Intl.RelativeTimeFormat("tr-TR", { numeric: "auto" });

/*
 * Birimler BÜYÜKTEN KÜÇÜĞE sıralı: ilk eşleşen kullanılıyor. Ters sırada
 * olsaydı iki günlük bir tarih "48 saat önce" diye yazılırdı.
 */
const SURE_BIRIMLERI = [
  ["year", 365 * 24 * 60 * 60],
  ["month", 30 * 24 * 60 * 60],
  ["day", 24 * 60 * 60],
  ["hour", 60 * 60],
  ["minute", 60]
];

/**
 * "3 dakika önce", "dün" gibi göreli zaman.
 *
 * Bildirim listesinde tam tarih yerine bu kullanılıyor: "12.11.2026 14:03"
 * okuyucuyu hesap yapmaya zorluyor, oysa bir bildirimde önemli olan "ne kadar
 * yeni" sorusu. Tam tarih başlık (title) olarak duruyor, fareyle üzerine
 * gelince görünüyor.
 */
export function gecenSure(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  const saniye = Math.round((date.getTime() - Date.now()) / 1000);
  for (const [birim, uzunluk] of SURE_BIRIMLERI) {
    if (Math.abs(saniye) >= uzunluk) return geceli.format(Math.round(saniye / uzunluk), birim);
  }
  // Bir dakikanın altı: "15 saniye önce" gereksiz kesinlik.
  return "az önce";
}

/** Yalnızca http/https adresini döndürür; aksi halde boş metin. */
export function safeUrl(value) {
  try {
    const url = new URL(String(value));
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

export const ORDER_STATUS = {
  pending_payment: { label: "Ödeme bekleniyor", tone: "warn" },
  paid: { label: "Ödendi", tone: "info" },
  payment_failed: { label: "Ödeme başarısız", tone: "bad" },
  cancelled: { label: "İptal edildi", tone: "bad" },
  completed: { label: "Tamamlandı", tone: "good" }
};

export const PACKAGE_STATUS = {
  pending: { label: "Bekliyor", tone: "warn" },
  preparing: { label: "Hazırlanıyor", tone: "info" },
  shipped: { label: "Kargoya verildi", tone: "info" },
  delivered: { label: "Teslim edildi", tone: "good" },
  cancelled: { label: "İptal edildi", tone: "bad" },
  refunded: { label: "İade edildi", tone: "bad" }
};

export const PRODUCT_STATUS = {
  draft: { label: "Taslak", tone: "neutral" },
  active: { label: "Yayında", tone: "good" },
  archived: { label: "Arşivde", tone: "neutral" }
};

export const STORE_STATUS = {
  pending: { label: "Onay bekliyor", tone: "warn" },
  active: { label: "Aktif", tone: "good" },
  suspended: { label: "Askıda", tone: "bad" }
};

export const TICKET_STATUS = {
  open: { label: "Açık", tone: "warn" },
  in_progress: { label: "İnceleniyor", tone: "info" },
  answered: { label: "Yanıtlandı", tone: "good" },
  closed: { label: "Kapatıldı", tone: "neutral" }
};

/*
 * Talep önceliği.
 *
 * "Normal" listede ROZET OLARAK ÇİZİLMİYOR (bkz. talep görünümleri): varsayılan
 * değerin işarete ihtiyacı yok ve her satıra gri bir "Normal" etiketi koymak
 * listeyi gürültüye çeviriyordu. Rozet yalnızca varsayılandan sapan talepte
 * görünüyor, böylece göz doğrudan acil olanlara gidiyor.
 */
export const TICKET_PRIORITY = {
  urgent: { label: "Acil", tone: "bad" },
  high: { label: "Yüksek", tone: "warn" },
  normal: { label: "Normal", tone: "neutral" },
  low: { label: "Düşük", tone: "neutral" }
};

export const USER_STATUS = {
  active: { label: "Aktif", tone: "good" },
  suspended: { label: "Askıda", tone: "bad" }
};

export const ROLE_LABELS = {
  SYSTEM_ADMIN: "Sistem Yöneticisi",
  STORE_OWNER: "Mağaza Sahibi",
  STORE_STAFF: "Mağaza Çalışanı",
  CUSTOMER: "Müşteri"
};

export const CARRIERS = [
  "Yurtiçi Kargo",
  "Aras Kargo",
  "MNG Kargo",
  "PTT Kargo",
  "Sürat Kargo",
  "UPS",
  "Diğer"
];

export const describe = (map, key) => map[key] || { label: key || "—", tone: "neutral" };
