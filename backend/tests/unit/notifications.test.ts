"use strict";

/**
 * Bildirim üretimi ve kapsam denetimi.
 *
 * İki soru sınanıyor:
 *   1. Hangi olay KİMİN kutusuna hangi metinle düşüyor?
 *   2. Bir kutuyu okumaya kimin yetkisi var?
 *
 * İkisi de saf fonksiyon olduğu için veritabanı gerekmiyor; bildirimin
 * veritabanına yazılıp okunması entegrasyon testinde sınanıyor.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { renderNotifications } from "../../src/infrastructure/notifications/templates";
import { bildirimAlicisi } from "../../src/application/notifications/alici";
import { AccessPolicy } from "../../src/domain/identity/AccessPolicy";

const SIPARIS = "11111111-1111-4111-8111-111111111111";
const MUSTERI = "22222222-2222-4222-8222-222222222222";
const MAGAZA = "33333333-3333-4333-8333-333333333333";
const PAKET = "44444444-4444-4444-8444-444444444444";
const BASKA_MAGAZA = "55555555-5555-4555-8555-555555555555";

/* ---------------------------------------------------------------- metinler */

test("Tanınmayan olay bildirim üretmez", () => {
  assert.deepEqual(renderNotifications("bilinmeyen.olay", { aggregateId: SIPARIS, payload: {} }), []);
});

test("Ödeme alındığında müşteriye ve her mağazaya ayrı bildirim düşer", () => {
  const drafts = renderNotifications("order.paid", {
    aggregateId: SIPARIS,
    payload: {
      orderNumber: "PZ-1001",
      userId: MUSTERI,
      packages: [
        { storeId: MAGAZA, packageId: PAKET },
        { storeId: BASKA_MAGAZA, packageId: null }
      ]
    }
  });

  assert.equal(drafts.length, 3);

  const musteri = drafts.find((draft) => draft.scope === "user");
  assert.equal(musteri?.scopeId, MUSTERI);
  assert.match(String(musteri?.title), /Ödemeniz alındı/);
  /*
   * Bağlantı SİPARİŞ NUMARASINI taşıyor, iç kimliği değil: bildirime tıklayan
   * kullanıcı adres çubuğunda okunur bir şey görsün ve bağlantıyı
   * paylaşabilsin.
   */
  assert.equal(musteri?.url, "/hesabim/siparisler/PZ-1001");

  // Mağaza bağlantısı da sipariş numarasıyla: bir siparişin bir mağazada
  // yalnızca BİR paketi olabildiği için numara paketi tek başına gösteriyor.
  const magazalar = drafts.filter((draft) => draft.scope === "store");
  assert.equal(magazalar.length, 2);
  assert.equal(magazalar[0].url, `/magaza/${MAGAZA}/siparisler/PZ-1001`);
  assert.equal(magazalar[1].url, `/magaza/${BASKA_MAGAZA}/siparisler/PZ-1001`);
});

test("Misafir siparişinde müşteri bildirimi yok, mağaza bildirimi var", () => {
  const drafts = renderNotifications("order.paid", {
    aggregateId: SIPARIS,
    payload: { orderNumber: "PZ-1002", userId: null, packages: [{ storeId: MAGAZA, packageId: PAKET }] }
  });

  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].scope, "store");
});

test("Sipariş verildiğinde yalnızca müşteri haber alır, mağaza değil", () => {
  const drafts = renderNotifications("order.placed", {
    aggregateId: SIPARIS,
    payload: {
      orderNumber: "PZ-1003",
      userId: MUSTERI,
      total: "1.250,00",
      packages: [{ storeId: MAGAZA, storeName: "Teknoloji Deposu" }]
    }
  });

  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].scope, "user");
  assert.match(String(drafts[0].body), /PZ-1003/);
});

test("Paket durumu kullanıcının anlayacağı başlığa çevrilir", () => {
  const kargoda = renderNotifications("order.package_status_changed", {
    aggregateId: SIPARIS,
    payload: { orderNumber: "PZ-1004", userId: MUSTERI, status: "shipped" }
  });
  assert.equal(kargoda.length, 1);
  assert.match(String(kargoda[0].title), /kargoya verildi/);
  // Tür, durumu içerir: arayüz simgeyi buna göre seçiyor.
  assert.equal(kargoda[0].kind, "order.package_shipped");

  // Tanınmayan durum için metin uydurulmuyor.
  const bilinmeyen = renderNotifications("order.package_status_changed", {
    aggregateId: SIPARIS,
    payload: { orderNumber: "PZ-1004", userId: MUSTERI, status: "uzaya_gonderildi" }
  });
  assert.deepEqual(bilinmeyen, []);
});

test("Destek talebi mağazaya açıldıysa mağazaya, açılmadıysa yönetime düşer", () => {
  const magazaya = renderNotifications("support.ticket_opened", {
    aggregateId: "66666666-6666-4666-8666-666666666666",
    payload: { reference: "DT-000100", subject: "Kargo gecikti", userId: MUSTERI, storeId: MAGAZA }
  });
  assert.deepEqual(
    magazaya.map((draft) => draft.scope),
    ["user", "store"]
  );

  const yonetime = renderNotifications("support.ticket_opened", {
    aggregateId: "66666666-6666-4666-8666-666666666666",
    payload: { reference: "DT-000101", subject: "Hesap sorunu", userId: MUSTERI, storeId: null }
  });
  assert.deepEqual(
    yonetime.map((draft) => draft.scope),
    ["user", "admin"]
  );
  // Yönetim kutusu kimseye bağlı değil.
  assert.equal(yonetime[1].scopeId, null);
});

test("Alıcısı belirsiz bildirim hiç üretilmez", () => {
  // Mağaza onaylandı ama sahibi bilinmiyor: yazılacak bir kutu yok.
  assert.deepEqual(
    renderNotifications("store.approved", { aggregateId: MAGAZA, payload: { name: "Teknoloji Deposu" } }),
    []
  );

  // Başvuruda sahip yoksa yönetim bildirimi yine düşer.
  const basvuru = renderNotifications("store.applied", {
    aggregateId: MAGAZA,
    payload: { name: "Yeni Mağaza" }
  });
  assert.equal(basvuru.length, 1);
  assert.equal(basvuru[0].scope, "admin");
});

test("Parola sıfırlama İSTEĞİ bildirim üretmez, değişiklik üretir", () => {
  assert.deepEqual(
    renderNotifications("user.password_reset_requested", { aggregateId: MUSTERI, payload: { resetToken: "x" } }),
    []
  );

  const degisti = renderNotifications("user.password_changed", { aggregateId: MUSTERI, payload: {} });
  assert.equal(degisti.length, 1);
  assert.equal(degisti[0].scopeId, MUSTERI);
});

/* ------------------------------------------------------------ kapsam ve yetki */

const magazaPolicy = (storeId: string) =>
  new AccessPolicy([{ roleCode: "STORE_OWNER", storeId, permissions: ["notification:read"] }]);

const yoneticiPolicy = () => new AccessPolicy([{ roleCode: "SYSTEM_ADMIN", storeId: null, permissions: [] }]);

test("Kişi kendi kutusunu yetki sormadan okur, numara olmadan okumaz", () => {
  assert.deepEqual(bildirimAlicisi("mine", { userId: MUSTERI }), { scope: "user", scopeId: MUSTERI });
  assert.throws(() => bildirimAlicisi("mine", {}), /Kullanıcı numarası/);
});

test("Mağaza kutusu yalnızca o mağazada yetkili olana açılır", () => {
  const context = { policy: magazaPolicy(MAGAZA) };

  assert.deepEqual(bildirimAlicisi("store", { storeId: MAGAZA }, context), { scope: "store", scopeId: MAGAZA });

  // Başka mağazanın kutusu: aynı izin, yanlış kapsam.
  assert.throws(() => bildirimAlicisi("store", { storeId: BASKA_MAGAZA }, context), /yetkiniz yok/);
  // Yetkisiz istek.
  assert.throws(() => bildirimAlicisi("store", { storeId: MAGAZA }, {}), /yetkiniz yok/);
  // Mağaza numarası verilmedi.
  assert.throws(() => bildirimAlicisi("store", {}, context), /Mağaza numarası/);
});

test("Yönetim kutusu mağaza yetkisiyle açılmaz", () => {
  assert.throws(() => bildirimAlicisi("admin", {}, { policy: magazaPolicy(MAGAZA) }), /yetkiniz yok/);
  assert.deepEqual(bildirimAlicisi("admin", {}, { policy: yoneticiPolicy() }), { scope: "admin", scopeId: null });
});
