"use strict";

import type { Row } from "../../src/application/shared/contracts";

import test from "node:test";
import assert from "node:assert/strict";

import { Money } from "../../src/domain/shared/Money";
import { isUuid, isEmail, isPhone, slugify, requireQuantity } from "../../src/domain/shared/guards";
import { ValidationError, ConflictError, ForbiddenError } from "../../src/domain/shared/errors";

import { MAX_GALLERY, Product, ProductStatus } from "../../src/domain/catalog/Product";
import { Order } from "../../src/domain/ordering/Order";
import {
  OrderStatus,
  PackageStatus,
  assertPackageTransition,
  deriveOrderStatus,
  canCustomerCancel,
  releasesStock
} from "../../src/domain/ordering/OrderStatus";
import { Cart } from "../../src/domain/ordering/Cart";
import { createShipping } from "../../src/domain/ordering/Shipping";
import { AccessPolicy } from "../../src/domain/identity/AccessPolicy";
import { RoleCodes } from "../../src/domain/identity/Role";
import { assertPasswordStrength, validateRegistration } from "../../src/domain/identity/User";
import { createStoreApplication, assertStoreTransition, StoreStatus } from "../../src/domain/stores/Store";
import { assertRedirectUri, resolveScope } from "../../src/domain/identity/OAuthClient";

/* ----------------------------------------------------------------- para */

test("Money kuruş üzerinden çalışır ve kayan nokta hatası üretmez", () => {
  assert.equal(Money.fromAmount("19.99").cents, 1999);
  assert.equal(Money.fromAmount(0.1).add(Money.fromAmount(0.2)).toDecimalString(), "0.30");
  assert.equal(Money.fromAmount("1").multiply(3).toDecimalString(), "3.00");
  assert.equal(Money.sum([Money.fromAmount("10.10"), Money.fromAmount("0.90")]).toDecimalString(), "11.00");
});

test("Money geçersiz tutarı reddeder", () => {
  for (const value of ["", "-1", "abc", "1.234", null, undefined, true, {}, "1e5", NaN]) {
    assert.throws(() => Money.fromAmount(value), ValidationError, `kabul edilmemeliydi: ${String(value)}`);
  }
});

/* --------------------------------------------------------------- guards */

test("Kimlik, e-posta ve telefon denetimleri", () => {
  assert.equal(isUuid("3f2504e0-4f89-41d3-9a0c-0305e82c3301"), true);
  assert.equal(isUuid("1 OR 1=1"), false);
  assert.equal(isUuid(123), false);
  assert.equal(isUuid("00000000-0000-0000-0000-000000000000"), false, "sürüm alanı geçersiz");
  assert.equal(isEmail("a@b.co"), true);
  assert.equal(isEmail("a@b"), false);
  assert.equal(isPhone("0555 111 22 33"), true);
  assert.equal(isPhone("<script>"), false);
  assert.equal(slugify("Ürün Çöp Şişe"), "urun-cop-sise");
  assert.throws(() => requireQuantity(0), ValidationError);
  assert.throws(() => requireQuantity(100), ValidationError);
  assert.equal(requireQuantity("3"), 3);
});

/* -------------------------------------------------------------- katalog */

test("Product alanları doğrular ve kırpar", () => {
  const base = { description: "Açıklama", imageUrl: "/images/urunler/ssd.png", storeId: "s1" };
  const product = Product.create({ ...base, name: "  Klavye  ", price: "10.5", stock: "3" });

  assert.equal(product.name, "Klavye");
  assert.equal(product.slug, "klavye");
  assert.equal(product.price.toDecimalString(), "10.50");
  assert.equal(product.stock, 3);
  assert.equal(product.isPurchasable, true);

  assert.throws(() => Product.create({ ...base, name: "", price: 1, stock: 1 }), ValidationError);
  assert.throws(() => Product.create({ ...base, name: "x", price: -1, stock: 1 }), ValidationError);
  assert.throws(() => Product.create({ ...base, name: "x", price: 1, stock: -1 }), ValidationError);
  assert.throws(() => Product.create({ ...base, name: "x", price: 1, stock: 1.5 }), ValidationError);
});

test("Product görseli yalnızca yerel varlık veya https kabul eder", () => {
  const base = { name: "x", description: "d", price: 1, stock: 1, storeId: "s1" };
  const kotuAdresler = [
    "javascript:alert(1)",
    "http://site.test/a.png",
    "data:text/html,<script>",
    "/images/../../etc/passwd",
    'x" onerror="alert(1)',
    "",
    "   "
  ];
  for (const imageUrl of kotuAdresler) {
    assert.throws(() => Product.create({ ...base, imageUrl }), ValidationError, imageUrl);
  }
  assert.equal(Product.create({ ...base, imageUrl: "https://cdn.test/a.png" }).imageUrl, "https://cdn.test/a.png");
  assert.equal(Product.create({ ...base, imageUrl: "/images/a.png" }).imageUrl, "/images/a.png");
});

test("Product ek görselleri kapakla aynı kurallardan geçer", () => {
  const base = { name: "x", description: "d", price: 1, stock: 1, storeId: "s1", imageUrl: "/images/a.png" };

  // Galeri verilmezse boş liste — null ya da undefined değil, çünkü okuyan
  // hiçbir kod null denetimi yapmak zorunda kalmamalı.
  assert.deepEqual(Product.create(base).galleryUrls, []);

  // Kapaktaki güvenlik kuralları burada da geçerli: tek bir zayıf adres
  // yeterdi, çünkü galeri de aynı <img> etiketine giriyor.
  assert.throws(() => Product.create({ ...base, galleryUrls: ["javascript:alert(1)"] }), ValidationError);
  assert.throws(() => Product.create({ ...base, galleryUrls: ["http://site.test/a.png"] }), ValidationError);
  assert.throws(() => Product.create({ ...base, galleryUrls: "/images/b.png" }), ValidationError);

  // Tekrarlar atılır: aynı dosya iki kez yüklendiğinde galeride iki kez
  // görünmemeli.
  assert.deepEqual(Product.create({ ...base, galleryUrls: ["/images/b.png", "/images/b.png"] }).galleryUrls, [
    "/images/b.png"
  ]);

  // Sayı sınırı: istemci yüz adres gönderip ürün sayfasını şişiremesin.
  const cokFazla = Array.from({ length: MAX_GALLERY + 1 }, (_, i) => `/images/g${i}.png`);
  assert.throws(() => Product.create({ ...base, galleryUrls: cokFazla }), ValidationError);
  assert.equal(Product.create({ ...base, galleryUrls: cokFazla.slice(0, MAX_GALLERY) }).galleryUrls.length, MAX_GALLERY);
});

test("Product.fromImportRow eksik alanlara varsayılan verir ve satırı bildirir", () => {
  const defaults = { storeId: "s1", imageUrl: "/images/varsayilan.png" };
  const product = Product.fromImportRow({ name: "SSD", price: 1200 }, 2, defaults);

  assert.equal(product.description, "SSD");
  assert.equal(product.stock, 0);
  assert.equal(product.status, ProductStatus.DRAFT);
  assert.throws(() => Product.fromImportRow({ name: "", price: 1 }, 7, defaults), /7\. satır/);
});

/* -------------------------------------------------------------- sepet */

const cartProduct = (overrides: Row) => ({
  id: "p1",
  name: "Ürün",
  slug: "urun",
  imageUrl: "/images/a.png",
  price: Money.fromAmount("100"),
  stock: 5,
  status: "active",
  storeId: "s1",
  storeName: "Mağaza",
  storeSlug: "magaza",
  ...overrides
});

test("Cart güncel fiyatla toplar ve sorunlu satırı işaretler", () => {
  const products = new Map([
    ["p1", cartProduct({})],
    ["p2", cartProduct({ id: "p2", status: "draft" })],
    ["p3", cartProduct({ id: "p3", stock: 1 })]
  ]);
  const view = new Cart(
    [
      { productId: "p1", quantity: 2 },
      { productId: "p2", quantity: 1 },
      { productId: "p3", quantity: 3 },
      { productId: "yok", quantity: 1 }
    ],
    products
  ).toView();

  assert.equal(view.itemCount, 7);
  assert.equal(view.subtotal.cents, 20000, "yalnızca satın alınabilir satırlar toplanır");
  assert.equal(view.hasIssues, true);
  assert.equal(view.canCheckout, false);
  assert.deepEqual(
    view.items.map((item) => item.issue),
    [null, "unavailable", "insufficient_stock", "removed"]
  );
  assert.equal(view.items[0].storeSlug, "magaza", "ürün bağlantısı için mağaza adresi gerekir");
});

test("Cart.merge misafir sepetini kaybetmeden birleştirir", () => {
  const merged = Cart.merge(
    [{ productId: "a", quantity: 2 }],
    [
      { productId: "a", quantity: 3 },
      { productId: "b", quantity: 1 }
    ]
  );
  assert.deepEqual(merged, [
    { productId: "a", quantity: 5 },
    { productId: "b", quantity: 1 }
  ]);
});

test("Cart adet ve çeşit sınırlarını korur", () => {
  assert.throws(() => Cart.assertCanAdd([{ productId: "a", quantity: 98 }], "a", 5), ConflictError);
  const dolu = Array.from({ length: 50 }, (_, index) => ({ productId: `p${index}`, quantity: 1 }));
  assert.throws(() => Cart.assertCanAdd(dolu, "yeni", 1), ConflictError);
  assert.equal(Cart.assertCanAdd(dolu, "p0", 1), 2, "var olan satıra eklemek sınırı aşmaz");
});

test("Cart boş veya sorunluysa siparişe çevrilemez", () => {
  assert.throws(() => new Cart([], new Map()).assertCheckoutReady(), ValidationError);
  const products = new Map([["p1", cartProduct({ stock: 0 })]]);
  assert.throws(() => new Cart([{ productId: "p1", quantity: 1 }], products).assertCheckoutReady(), ConflictError);
});

/* ----------------------------------------------------------- sipariş */

const checkout = (overrides: Record<string, unknown> = {}) => ({
  contact: { email: "ALI@Example.com", fullName: "Ali Veli", phone: "0555 000 00 00" },
  shippingAddress: { fullName: "Ali Veli", city: "İstanbul", district: "Kadıköy", line: "Adres 1" },
  ...overrides
});

const orderProduct = (overrides: Row) => ({
  id: "p1",
  name: "Ürün",
  priceCents: 10000,
  stock: 5,
  status: "active",
  imageUrl: "/images/a.png",
  storeId: "s1",
  storeName: "Mağaza A",
  storeStatus: "active",
  ...overrides
});

test("validateCheckout e-postayı küçültür ve eksik alanı reddeder", () => {
  const result = Order.validateCheckout(checkout());
  assert.equal(result.contact.email, "ali@example.com");

  assert.throws(() => Order.validateCheckout(), ValidationError);
  assert.throws(
    () => Order.validateCheckout(checkout({ contact: { email: "yok", fullName: "A", phone: "0555" } })),
    ValidationError
  );
});

test("Order.place siparişi mağazalara böler ve tutarı sunucuda hesaplar", () => {
  const products = new Map([
    ["p1", orderProduct({})],
    ["p2", orderProduct({ id: "p2", priceCents: 2500, storeId: "s2", storeName: "Mağaza B" })]
  ]);
  const order = Order.place({
    userId: "u1",
    checkout: Order.validateCheckout(checkout()),
    lines: [
      { productId: "p1", quantity: 2 },
      { productId: "p2", quantity: 1 }
    ],
    products
  });

  assert.equal(order.packages.length, 2, "iki mağaza iki pakete bölünür");
  assert.equal(order.total.toDecimalString(), "225.00");
  assert.equal(order.status, OrderStatus.PENDING_PAYMENT);
  assert.equal(order.packages[0].status, PackageStatus.PENDING);
});

test("Order.place stok, satış durumu ve mağaza durumunu denetler", () => {
  const line = [{ productId: "p1", quantity: 2 }];
  const valid = Order.validateCheckout(checkout());

  const az = new Map([["p1", orderProduct({ stock: 1 })]]);
  assert.throws(() => Order.place({ checkout: valid, lines: line, products: az }), ConflictError);

  const pasif = new Map([["p1", orderProduct({ status: "draft" })]]);
  assert.throws(() => Order.place({ checkout: valid, lines: line, products: pasif }), ConflictError);

  const askida = new Map([["p1", orderProduct({ storeStatus: "suspended" })]]);
  assert.throws(() => Order.place({ checkout: valid, lines: line, products: askida }), /satış yapmıyor/);

  assert.throws(() => Order.place({ checkout: valid, lines: [], products: new Map() }), ValidationError);
});

test("Paket yaşam döngüsü basamak atlamaya izin vermez", () => {
  assert.doesNotThrow(() => assertPackageTransition(PackageStatus.PENDING, PackageStatus.PREPARING));
  assert.throws(() => assertPackageTransition(PackageStatus.PENDING, PackageStatus.DELIVERED), ConflictError);
  assert.throws(() => assertPackageTransition(PackageStatus.CANCELLED, PackageStatus.PREPARING), ConflictError);
  assert.equal(releasesStock(PackageStatus.CANCELLED), true);
  assert.equal(releasesStock(PackageStatus.SHIPPED), false);
  assert.equal(canCustomerCancel(PackageStatus.SHIPPED), false);
  assert.equal(canCustomerCancel(PackageStatus.PREPARING), true);
});

test("Sipariş durumu paketlerden türetilir", () => {
  const paid = OrderStatus.PAID;
  assert.equal(deriveOrderStatus(paid, ["delivered", "delivered"]), OrderStatus.COMPLETED);
  assert.equal(deriveOrderStatus(paid, ["cancelled", "cancelled"]), OrderStatus.CANCELLED);
  assert.equal(deriveOrderStatus(paid, ["delivered", "preparing"]), OrderStatus.PAID);
  assert.equal(
    deriveOrderStatus(OrderStatus.PENDING_PAYMENT, ["delivered"]),
    OrderStatus.PENDING_PAYMENT,
    "ödeme beklenirken paketler durumu değiştiremez"
  );
});

test("createShipping yalnızca http/https bağlantı kabul eder", () => {
  assert.equal(createShipping({ trackingUrl: "https://kargo.test/1" }).trackingUrl, "https://kargo.test/1");
  assert.equal(createShipping({}).carrier, null);
  assert.throws(() => createShipping({ trackingUrl: "javascript:alert(1)" }), ValidationError);
});

/* ---------------------------------------------------------- yetkiler */

test("AccessPolicy mağaza kapsamını ayırır", () => {
  const policy = new AccessPolicy([
    { roleCode: RoleCodes.STORE_OWNER, storeId: "s1", permissions: ["catalog:product:write", "order:read"] }
  ]);

  assert.equal(policy.can("catalog:product:write", { storeId: "s1" }), true);
  assert.equal(policy.can("catalog:product:write", { storeId: "s2" }), false, "başka mağazada yetki yok");
  assert.equal(policy.can("catalog:product:write"), false, "kapsam verilmeden mağaza izni geçmez");
  assert.equal(policy.can("user:read"), false);
  assert.equal(policy.isSystemAdmin(), false);
  assert.deepEqual(policy.ownedStoreIds(), ["s1"]);
  assert.throws(() => policy.assert("user:read"), ForbiddenError);
});

test("AccessPolicy sistem yöneticisine her şeyi açar, mağaza rolü sistem iznini vermez", () => {
  const admin = new AccessPolicy([{ roleCode: RoleCodes.SYSTEM_ADMIN, storeId: null, permissions: [] }]);
  assert.equal(admin.isSystemAdmin(), true);
  assert.equal(admin.can("system:settings"), true);
  assert.equal(admin.can("catalog:product:write", { storeId: "herhangi" }), true);

  // Mağazaya bağlı atama, sistem geneli izni asla vermez.
  const sahte = new AccessPolicy([{ roleCode: RoleCodes.STORE_OWNER, storeId: "s1", permissions: ["user:read"] }]);
  assert.equal(sahte.can("user:read"), false);

  assert.equal(AccessPolicy.empty().can("catalog:product:read", { storeId: "s1" }), false);
});

/* ----------------------------------------------------------- kimlik */

test("Parola kuralı zayıf parolaları reddeder", () => {
  assert.doesNotThrow(() => assertPasswordStrength("GucluParola1"));
  assert.throws(() => assertPasswordStrength("kisa1"), /10 karakter/);
  assert.throws(() => assertPasswordStrength("sadeceharfler"), /rakam/);
  assert.throws(() => assertPasswordStrength("1234567890"), /harf/);
  assert.throws(() => assertPasswordStrength("password12"), /yaygın/);
  assert.throws(() => assertPasswordStrength("ahmet123456", { email: "ahmet@test.com" }), /e-posta/);
  assert.throws(() => assertPasswordStrength(12345678901), ValidationError);
});

test("validateRegistration e-postayı normalleştirir", () => {
  const result = validateRegistration({ fullName: " Ali Veli ", email: " ALI@X.COM ", password: "Parolam123" });
  assert.equal(result.email, "ali@x.com");
  assert.equal(result.fullName, "Ali Veli");
  assert.equal(result.phone, null);
});

/* ---------------------------------------------------------- mağaza */

test("Mağaza başvurusu ve durum geçişleri", () => {
  const store = createStoreApplication({
    name: "Teknoloji Deposu",
    description: "Açıklama",
    contactEmail: "a@b.co",
    phone: "0555 111 22 33"
  });
  assert.equal(store.slug, "teknoloji-deposu");
  assert.equal(store.status, StoreStatus.PENDING);

  assert.doesNotThrow(() => assertStoreTransition(StoreStatus.PENDING, StoreStatus.ACTIVE));
  assert.throws(() => assertStoreTransition(StoreStatus.ACTIVE, StoreStatus.PENDING), ConflictError);
  assert.throws(() => createStoreApplication({ name: "ab" }), ValidationError);
});

/* ----------------------------------------------------------- OAuth */

test("redirect_uri tam eşleşme ister (açık yönlendirme kapalı)", () => {
  const client = { redirectUris: ["https://site.test/auth/callback"], scopes: ["openid", "shop"] };

  assert.doesNotThrow(() => assertRedirectUri(client, "https://site.test/auth/callback"));
  for (const kotu of [
    "https://site.test/auth/callback/../../evil",
    "https://site.test/auth/callback?x=1",
    "https://evil.test/auth/callback",
    "https://site.test/auth/callbackX",
    undefined
  ]) {
    assert.throws(() => assertRedirectUri(client, kotu), ValidationError, String(kotu));
  }
});

test("scope istemcinin izin verdiğiyle kesişir", () => {
  const client = { scopes: ["openid", "shop"] };
  assert.equal(resolveScope(client, "openid shop"), "openid shop");
  assert.equal(resolveScope(client, "openid"), "openid");
  assert.equal(resolveScope(client, undefined), "openid shop", "boş istek istemcinin tamamını verir");
  assert.throws(() => resolveScope(client, "admin"), ValidationError);
  assert.throws(() => resolveScope(client, "uydurma"), /Bilinmeyen/);
});
