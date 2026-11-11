"use strict";

import type { NotificationScope } from "../../application/shared/contracts";

/**
 * Olaydan bildirim üretimi.
 *
 * E-posta şablonlarının (mail/templates.ts) kardeşidir ve AYNI olaylardan
 * beslenir: bir olay hem e-postaya hem zile dönüşür, ikisi birbirinden
 * habersiz üretilmez. Sebebi şu: kullanıcıya "siparişiniz kargoya verildi"
 * diyen e-posta gidip zilde hiçbir şey görünmezse (ya da tersi) iki kanal
 * birbirini yalanlar.
 *
 * Fark şurada: e-posta BİR alıcıya gider, bildirim birden fazla kutuya
 * düşebilir — bir sipariş ödendiğinde müşteri "ödemeniz alındı", her mağaza
 * da "paketiniz hazırlanabilir" bildirimi alır. Bu yüzden şablon tek nesne
 * değil LİSTE döndürüyor.
 *
 * Metinler burada kısa: zil panelinde iki satır yer var. Ayrıntı e-postada.
 */

/** Üretilen bildirim; numarası yazma tarafında verilir. */
export interface NotificationDraft {
  readonly scope: NotificationScope;
  readonly scopeId: string | null;
  readonly kind: string;
  readonly title: string;
  readonly body?: string;
  /** Site içi yol; tam adres değil (bkz. 004_notifications.sql). */
  readonly url?: string | null;
}

/** Şablona giren olay: zarf (aggregateId) ve içerik birlikte. */
export interface NotificationEvent {
  readonly aggregateId: string | null;
  readonly payload: any;
}

type Template = (event: NotificationEvent) => NotificationDraft[];

/** Paket durumlarının kullanıcıya görünen hâli. */
const PAKET_DURUMU: Record<string, { baslik: string; metin: string }> = {
  preparing: { baslik: "Siparişiniz hazırlanıyor", metin: "Mağaza paketinizi hazırlamaya başladı." },
  shipped: { baslik: "Siparişiniz kargoya verildi", metin: "Paketiniz yola çıktı." },
  delivered: { baslik: "Siparişiniz teslim edildi", metin: "Paketiniz teslim edildi. İyi günlerde kullanın." },
  cancelled: { baslik: "Paketiniz iptal edildi", metin: "Siparişinizin bir paketi iptal edildi." },
  refunded: { baslik: "İadeniz işlendi", metin: "Siparişinizin bir paketi iade edildi." }
};

const siparisYolu = (orderId: string | null) => (orderId ? `/hesabim/siparisler/${orderId}` : "/hesabim/siparisler");

/**
 * Mağaza paketinin yolu.
 *
 * Mağaza panelinde sipariş detayı PAKET numarasıyla açılır (her mağaza
 * yalnızca kendi paketini görür), sipariş numarasıyla değil. Paket numarası
 * olayda yoksa listeye düşülür — var olmayan bir sayfaya göndermekten iyidir.
 */
const paketYolu = (storeId: string, packageId?: string | null) =>
  packageId ? `/magaza/${storeId}/siparisler/${packageId}` : `/magaza/${storeId}/siparisler`;

/** Olaydaki paket listesi; alan hiç yoksa boş dizi. */
const paketler = (payload: any): { storeId: string; packageId?: string | null }[] =>
  Array.isArray(payload?.packages) ? payload.packages.filter((paket: any) => paket?.storeId) : [];

const templates: Record<string, Template> = {
  "user.registered": ({ aggregateId }) => [
    {
      scope: "user",
      scopeId: aggregateId,
      kind: "user.registered",
      title: "Donanex'a hoş geldiniz",
      body: "Hesabınız oluşturuldu. E-posta adresinizi doğrulayarak tüm özellikleri kullanabilirsiniz.",
      url: "/hesabim/profil"
    }
  ],

  /*
   * Parola sıfırlama İSTEĞİ için bildirim üretilmiyor.
   *
   * O isteği hesabın sahibi olmayan biri de başlatabilir (e-posta adresini
   * bilmek yeter). Bildirim, isteği başlatan kişiye değil hesap sahibine
   * görünürdü ve "parolan sıfırlanıyor" gibi okunurdu — oysa henüz hiçbir şey
   * değişmedi. Değişiklik gerçekleştiğinde aşağıdaki bildirim düşüyor.
   */

  "user.password_changed": ({ aggregateId }) => [
    {
      scope: "user",
      scopeId: aggregateId,
      kind: "user.password_changed",
      title: "Parolanız değiştirildi",
      body: "Diğer cihazlardaki oturumlarınız kapatıldı. Bu işlemi siz yapmadıysanız destek ekibine yazın.",
      url: "/hesabim/profil"
    }
  ],

  "store.applied": ({ aggregateId, payload }) => {
    const drafts: NotificationDraft[] = [
      {
        scope: "admin",
        scopeId: null,
        kind: "store.applied",
        title: "Yeni mağaza başvurusu",
        body: `${payload.name} başvurdu. İnceleyip onaylayabilirsiniz.`,
        url: "/yonetim/magazalar"
      }
    ];
    if (payload.ownerUserId) {
      drafts.push({
        scope: "user",
        scopeId: payload.ownerUserId,
        kind: "store.applied",
        title: "Mağaza başvurunuz alındı",
        body: `${payload.name} başvurunuz incelemeye alındı.`,
        url: "/hesabim/magaza-basvurusu"
      });
    }
    // aggregateId mağaza numarası; başvuru aşamasında panel henüz açılmadığı
    // için mağaza kutusuna bildirim yazılmıyor.
    void aggregateId;
    return drafts;
  },

  "store.approved": ({ aggregateId, payload }) =>
    payload.ownerUserId
      ? [
          {
            scope: "user",
            scopeId: payload.ownerUserId,
            kind: "store.approved",
            title: "Mağazanız onaylandı",
            body: `${payload.name} artık satışa açık. Ürün ekleyip satmaya başlayabilirsiniz.`,
            url: `/magaza/${aggregateId}`
          }
        ]
      : [],

  /*
   * Sipariş verildi: yalnızca MÜŞTERİYE.
   *
   * Mağazalar bu noktada haber almıyor, çünkü ödeme henüz alınmadı ve ödemesi
   * gelmeyen sipariş kendiliğinden iptal oluyor. Mağazaya "yeni sipariş" demek,
   * ortalama olarak hazırlanmayacak paketler için bildirim üretmek olurdu.
   * Mağaza bildirimi aşağıda, order.paid ile düşüyor.
   *
   * Misafir siparişinde (userId yok) bildirim de yok: gösterilecek bir hesap
   * kutusu yok, e-posta ve takip kodu zaten gidiyor.
   */
  "order.placed": ({ aggregateId, payload }) =>
    payload.userId
      ? [
          {
            scope: "user",
            scopeId: payload.userId,
            kind: "order.placed",
            title: "Siparişiniz alındı",
            body: `${payload.orderNumber} numaralı siparişiniz alındı. Tutar: ${payload.total} TL`,
            url: siparisYolu(aggregateId)
          }
        ]
      : [],

  "order.paid": ({ aggregateId, payload }) => {
    const drafts: NotificationDraft[] = [];
    if (payload.userId) {
      drafts.push({
        scope: "user",
        scopeId: payload.userId,
        kind: "order.paid",
        title: "Ödemeniz alındı",
        body: `${payload.orderNumber} numaralı siparişinizin ödemesi alındı. Mağazalar hazırlamaya başlayacak.`,
        url: siparisYolu(aggregateId)
      });
    }
    for (const paket of paketler(payload)) {
      drafts.push({
        scope: "store",
        scopeId: paket.storeId,
        kind: "order.paid",
        title: "Yeni sipariş",
        body: `${payload.orderNumber} siparişinin ödemesi alındı. Paketi hazırlayabilirsiniz.`,
        url: paketYolu(paket.storeId, paket.packageId)
      });
    }
    return drafts;
  },

  "order.payment_failed": ({ aggregateId, payload }) =>
    payload.userId
      ? [
          {
            scope: "user",
            scopeId: payload.userId,
            kind: "order.payment_failed",
            title: "Ödeme tamamlanamadı",
            body: `${payload.orderNumber} numaralı sipariş iptal edildi, ürünler stoğa döndü.`,
            url: siparisYolu(aggregateId)
          }
        ]
      : [],

  "order.cancelled": ({ aggregateId, payload }) => {
    const drafts: NotificationDraft[] = [];
    if (payload.userId) {
      drafts.push({
        scope: "user",
        scopeId: payload.userId,
        kind: "order.cancelled",
        title: "Siparişiniz iptal edildi",
        body: `${payload.orderNumber} numaralı siparişiniz iptal edildi.`,
        url: siparisYolu(aggregateId)
      });
    }
    // Mağaza bunu BİLMEK ZORUNDA: hazırlamaya başlamadan haberi olmalı.
    for (const paket of paketler(payload)) {
      drafts.push({
        scope: "store",
        scopeId: paket.storeId,
        kind: "order.cancelled",
        title: "Sipariş iptal edildi",
        body: `${payload.orderNumber} siparişini müşteri iptal etti. Hazırlamaya başlamayın.`,
        url: paketYolu(paket.storeId, paket.packageId)
      });
    }
    return drafts;
  },

  /*
   * Paket durumu değişti: yalnızca MÜŞTERİYE.
   *
   * Durumu mağazanın kendisi değiştiriyor; kendi yaptığı işi kendisine
   * bildirmek bildirim kutusunu gürültüye çevirirdi.
   */
  "order.package_status_changed": ({ aggregateId, payload }) => {
    const durum = PAKET_DURUMU[payload.status];
    if (!durum || !payload.userId) return [];
    return [
      {
        scope: "user",
        scopeId: payload.userId,
        kind: `order.package_${payload.status}`,
        title: durum.baslik,
        body: `${payload.orderNumber} — ${durum.metin}`,
        url: siparisYolu(aggregateId)
      }
    ];
  },

  "support.ticket_opened": ({ aggregateId, payload }) => {
    const drafts: NotificationDraft[] = [];
    if (payload.userId) {
      drafts.push({
        scope: "user",
        scopeId: payload.userId,
        kind: "support.ticket_opened",
        title: "Destek talebiniz alındı",
        body: `${payload.reference} — ${payload.subject}`,
        url: "/hesabim/talepler"
      });
    }
    /*
     * Talep bir mağazaya açıldıysa o mağazanın kutusuna, açılmadıysa
     * yönetimin kutusuna düşer. İkisine birden düşmez: iki taraf da
     * "benim işim değil" diye bekleyebilir ya da ikisi birden yanıtlar.
     */
    if (payload.storeId) {
      drafts.push({
        scope: "store",
        scopeId: payload.storeId,
        kind: "support.ticket_opened",
        title: "Yeni destek talebi",
        body: `${payload.reference} — ${payload.subject}`,
        url: `/magaza/${payload.storeId}/talepler`
      });
    } else {
      drafts.push({
        scope: "admin",
        scopeId: null,
        kind: "support.ticket_opened",
        title: "Yeni destek talebi",
        body: `${payload.reference} — ${payload.subject}`,
        url: "/yonetim/talepler"
      });
    }
    void aggregateId;
    return drafts;
  },

  "support.ticket_answered": ({ payload }) =>
    payload.userId
      ? [
          {
            scope: "user",
            scopeId: payload.userId,
            kind: "support.ticket_answered",
            title: "Talebinize yanıt verildi",
            body: `${payload.reference} — ${payload.subject}`,
            url: "/hesabim/talepler"
          }
        ]
      : []
};

/**
 * Olayı bildirimlere çevirir; şablonu olmayan olay için boş dizi döner.
 *
 * Alıcısı belirsiz taslaklar (scopeId'si olması gerekirken boş kalanlar)
 * BURADA süzülüyor: olay beklenen alanı taşımıyorsa bildirim hiç yazılmasın,
 * veritabanı kısıtına çarpıp tüketiciyi döngüye sokmasın.
 */
export function renderNotifications(type: string, event: NotificationEvent): NotificationDraft[] {
  const template = templates[type];
  if (!template) return [];
  return template(event).filter((draft) => (draft.scope === "admin" ? draft.scopeId === null : Boolean(draft.scopeId)));
}

export { templates };
