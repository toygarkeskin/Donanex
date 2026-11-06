"use strict";

/**
 * Uçtan uca API testleri: gerçek PostgreSQL ve Redis, gerçek HTTP.
 * Çalıştırmak için:
 *   docker compose -f docker-compose.test.yml up --build --abort-on-container-exit --exit-code-from tests
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  enabled,
  skip,
  startHarness,
  Client,
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  DEMO_PASSWORD,
  REDIRECT_URI
} from "./helpers";

import type { Row } from "../../src/application/shared/contracts";
import type { ApiResponse } from "./helpers";
import crypto from "crypto";

/**
 * skip bir metin ya da false olabilir (helpers, TEST_DB_HOST yoksa nedenini
 * metin olarak verir). node:test ikisini de kabul eder.
 */
const opts = { skip };

/** startHarness in dondurdugu kosum takimi. */
type Harness = Awaited<ReturnType<typeof startHarness>>;

let app: Harness;
let anon: Client;

const checkout = (overrides: Row = {}) => ({
  contact: { email: "misafir@example.com", fullName: "Misafir Alıcı", phone: "0555 000 11 22" },
  shippingAddress: {
    fullName: "Misafir Alıcı",
    phone: "0555 000 11 22",
    city: "Ankara",
    district: "Çankaya",
    line: "Deneme Mah. 1. Cad. No:3"
  },
  ...overrides
});

const firstProduct = async (minStock = 1) => {
  const { data } = await anon.get("/api/products?pageSize=60");
  return data.items.find((product: Row) => product.stock >= minStock);
};

const stockOf = async (id: string) => {
  const { data } = await anon.get(`/api/products?pageSize=60`);
  return data.items.find((product: Row) => product.id === id)?.stock ?? null;
};

/**
 * Yanit basligi. Yoksa testi anlasilir bir mesajla dusurur: headers.get()
 * null donebilir ve "null regex e uymadi" demek nedeni gizler.
 */
function header(response: ApiResponse, name: string): string {
  const deger = response.headers.get(name);
  assert.ok(deger !== null, `${name} basligi yok`);
  return deger;
}

/** Sepete ekleyip sipariş veren kısa yol. */
async function placeGuestOrder(client: Client, productId: string, quantity = 1) {
  await client.post("/api/cart/items", { productId, quantity });
  const response = await client.post("/api/orders", checkout());
  return response;
}

// opts BURADA GECIRILMEZ: node:test in HookOptions tipi skip kabul etmiyor,
// yani eskiden verilen { skip } sessizce yok sayiliyordu. Atlamayi asagidaki
// enabled kontrolu yapiyor; testlerin kendisi opts i kullanmaya devam ediyor.
test.before(async () => {
  if (!enabled) return;
  app = await startHarness();
  anon = new Client(app.base);
});

test.after(async () => {
  if (app) await app.stop();
});

/* ------------------------------------------------------ sağlık ve keşif */

test("sağlık ve hazırlık uçları", opts, async () => {
  const health = await anon.get("/api/health");
  assert.equal(health.status, 200);

  const ready = await anon.get("/api/ready");
  assert.equal(ready.status, 200);
  assert.equal(ready.data.ready, true);
  assert.equal(ready.data.checks.database, true);
});

test("güvenlik başlıkları ve önbellek politikası", opts, async () => {
  const health = await anon.get("/api/health");
  assert.equal(health.headers.get("x-powered-by"), null, "sunucu yazılımı gizlenir");
  assert.equal(health.headers.get("x-content-type-options"), "nosniff");
  assert.match(header(health, "content-security-policy"), /default-src 'none'/);

  const products = await anon.get("/api/products");
  assert.equal(products.headers.get("cache-control"), "no-store", "API yanıtları önbelleklenmez");
});

test("OIDC keşif belgesi ve JWKS", opts, async () => {
  const discovery = await anon.get("/.well-known/openid-configuration");
  assert.equal(discovery.status, 200);
  assert.equal(discovery.data.issuer, "http://localhost:8090");
  assert.deepEqual(discovery.data.code_challenge_methods_supported, ["S256"], "PKCE zorunlu ilan edilir");
  assert.deepEqual(discovery.data.response_types_supported, ["code"], "örtük akış yok");

  const jwks = await anon.get("/oauth/jwks");
  assert.equal(jwks.data.keys[0].kty, "RSA");
  assert.ok(!("d" in jwks.data.keys[0]), "gizli anahtar sızmaz");
});

/* ------------------------------------------------------------- vitrin */

test("vitrin kayıtsız kullanıcıya açıktır", opts, async () => {
  const products = await anon.get("/api/products");
  assert.equal(products.status, 200);
  assert.ok(products.data.total > 10, `${products.data.total} ürün`);

  const categories = await anon.get("/api/categories");
  assert.ok(categories.data.items.length > 0);

  const stores = await anon.get("/api/storefront/stores");
  assert.ok(stores.data.items.length >= 4);

  const sample = products.data.items[0];
  const detail = await anon.get(`/api/products/${sample.storeSlug}/${sample.slug}`);
  assert.equal(detail.data.id, sample.id);
  assert.equal((await anon.get("/api/products/yok/yok")).status, 404);
});

test("arama ve filtreler; SQL enjeksiyonu ile joker etkisiz", opts, async () => {
  assert.ok((await anon.get("/api/products?q=klavye")).data.total > 0);
  assert.equal((await anon.get(`/api/products?q=${encodeURIComponent("' OR 1=1 --")}`)).data.total, 0);
  assert.equal((await anon.get(`/api/products?q=${encodeURIComponent("%")}`)).data.total, 0, "LIKE jokeri kaçırılır");
  assert.equal((await anon.get(`/api/products?q=${encodeURIComponent("_")}`)).data.total, 0);

  const filtered = await anon.get("/api/products?category=laptop");
  assert.ok(filtered.data.total > 0);
  assert.equal((await anon.get("/api/products?minPrice=999999")).data.total, 0);

  const paged = await anon.get("/api/products?pageSize=2&page=1");
  assert.equal(paged.data.items.length, 2);
  assert.ok(paged.data.pages > 1);
});

/* ------------------------------------------------- misafir sepeti ve sipariş */

test("misafir sepet açabilir, sepet sunucuda tutulur", opts, async () => {
  const guest = new Client(app.base);
  const product = await firstProduct(3);

  const added = await guest.post("/api/cart/items", { productId: product.id, quantity: 2 });
  assert.equal(added.status, 201);
  assert.equal(added.data.itemCount, 2);
  assert.ok(guest.cookies.dnx_cart, "sepet kimliği HttpOnly çerezde taşınır");

  const cart = await guest.get("/api/cart");
  assert.equal(cart.data.items.length, 1);
  assert.equal(cart.data.items[0].storeSlug, product.storeSlug, "ürün bağlantısı için mağaza adresi döner");

  const tooMany = await guest.put(`/api/cart/items/${product.id}`, { quantity: 99 });
  assert.equal(tooMany.status, 409);

  const removed = await guest.delete(`/api/cart/items/${product.id}`);
  assert.equal(removed.data.itemCount, 0);
});

test("sepet başka bir tarayıcıdan okunamaz", opts, async () => {
  const guest = new Client(app.base);
  const product = await firstProduct();
  await guest.post("/api/cart/items", { productId: product.id, quantity: 1 });

  const other = new Client(app.base);
  assert.equal((await other.get("/api/cart")).data.itemCount, 0, "çerezi olmayan boş sepet görür");
});

test("misafir kayıt olmadan sipariş verebilir ve takip kodu alır", opts, async () => {
  const guest = new Client(app.base);
  const product = await firstProduct(2);
  const before = product.stock;

  const order = await placeGuestOrder(guest, product.id, 2);
  assert.equal(order.status, 201);
  assert.match(order.data.orderNumber, /^PZ-\d{4}-\d{6}$/);
  assert.match(order.data.trackingCode, /^[a-f0-9]{64}$/);
  assert.ok(order.data.registrationHint, "kayıt olabileceği hatırlatılır");
  assert.equal(await stockOf(product.id), before - 2, "stok ayrılır");

  const mail = await app.outbox.waitFor((message) => message.subject.includes(order.data.orderNumber));
  assert.ok(mail, "sipariş e-postası gönderilir");
  assert.ok(mail.text.includes(order.data.trackingCode), "misafire takip kodu yazılır");
});

test("istemciden gelen fiyat ve toplam yok sayılır", opts, async () => {
  const guest = new Client(app.base);
  const product = await firstProduct();
  await guest.post("/api/cart/items", { productId: product.id, quantity: 1, price: 1 });

  const order = await guest.post("/api/orders", { ...checkout(), total: 1, items: [{ productId: product.id, quantity: 99 }] });
  assert.equal(order.status, 201);
  assert.equal(order.data.total.cents, product.price.cents, "tutar sunucuda hesaplanır");
});

test("geçersiz sipariş girdileri reddedilir", opts, async () => {
  const guest = new Client(app.base);
  const product = await firstProduct();
  await guest.post("/api/cart/items", { productId: product.id, quantity: 1 });

  assert.equal((await guest.post("/api/orders", {})).status, 400);
  assert.equal((await guest.post("/api/orders", checkout({ contact: { email: "yok" } }))).status, 400);
  assert.equal((await new Client(app.base).post("/api/orders", checkout())).status, 400, "boş sepet");

  assert.equal((await guest.post("/api/cart/items", { productId: "1; DROP TABLE orders", quantity: 1 })).status, 400);
  assert.equal((await guest.post("/api/cart/items", { productId: product.id, quantity: -1 })).status, 400);
  assert.equal((await guest.post("/api/cart/items", { productId: product.id, quantity: 1.5 })).status, 400);
});

test("eş zamanlı siparişler stoğu aşamaz", opts, async () => {
  const owner = new Client(app.base);
  assert.ok((await owner.signIn("teknoloji@donanex.test", DEMO_PASSWORD)).ok);
  const me = await owner.get("/api/me");
  const storeId = me.data.stores[0].id;

  const created = await owner.post(`/api/stores/${storeId}/products`, {
    name: "Yarış Testi Ürünü",
    description: "Eş zamanlılık testi.",
    price: "10.00",
    stock: 3,
    imageUrl: "/images/urunler/ssd.png",
    status: "active"
  });
  const productId = created.data.id;

  // On istemci aynı anda son üç ürüne talip olur.
  const attempts = await Promise.all(
    Array.from({ length: 10 }, async () => {
      const client = new Client(app.base);
      return placeGuestOrder(client, productId, 1);
    })
  );

  const statuses = attempts.map((result) => result.status);
  const failures = attempts
    .filter((result) => result.status >= 500)
    .map((result) => JSON.stringify(result.data));
  assert.equal(statuses.filter((status) => status === 201).length, 3, `yalnızca stok kadar sipariş geçer: ${statuses}`);
  assert.ok(
    statuses.every((status) => status === 201 || status === 409),
    `her istek ya başarılı ya "stok yetersiz" olmalı, sunucu hatası olmamalı: ${statuses} :: ${failures}`
  );
  assert.equal(await stockOf(productId), 0);
});

/* ------------------------------------------------------- ödeme ve takip */

test("ödeme ve sipariş görüntüleme takip kodu ister", opts, async () => {
  const guest = new Client(app.base);
  const product = await firstProduct();
  const order = await placeGuestOrder(guest, product.id);
  const { orderId, trackingCode, orderNumber } = order.data;

  // Takip kodu olmadan: bulunamadı.
  assert.equal((await anon.post(`/api/orders/${orderId}/payment`, { outcome: "success" })).status, 404);
  assert.equal(
    (await anon.post(`/api/orders/${orderId}/payment`, { outcome: "success", trackingCode: "0".repeat(64) })).status,
    404
  );
  assert.equal((await anon.post("/api/orders/track", { orderNumber, trackingCode: "0".repeat(64) })).status, 404);

  const tracked = await anon.post("/api/orders/track", { orderNumber, trackingCode });
  assert.equal(tracked.status, 200);
  assert.equal(tracked.data.orderNumber, orderNumber);
  for (const leak of ["contactEmail", "contactPhone", "shippingAddress"]) {
    assert.equal(leak in tracked.data, false, `${leak} takip yanıtında dönmemeli`);
  }
});

test("ödeme bir kez işlenir, başarısız ödeme stoğu iade eder", opts, async () => {
  const product = await firstProduct(2);
  const before = product.stock;

  const first = new Client(app.base);
  const success = await placeGuestOrder(first, product.id);
  const paid = await first.post(`/api/orders/${success.data.orderId}/payment`, {
    outcome: "success",
    trackingCode: success.data.trackingCode
  });
  assert.equal(paid.data.status, "paid");
  assert.equal(paid.data.simulated, true);

  const again = await first.post(`/api/orders/${success.data.orderId}/payment`, {
    outcome: "success",
    trackingCode: success.data.trackingCode
  });
  assert.equal(again.status, 409, "ödeme ikinci kez işlenemez");

  const second = new Client(app.base);
  const failing = await placeGuestOrder(second, product.id);
  await second.post(`/api/orders/${failing.data.orderId}/payment`, {
    outcome: "failure",
    trackingCode: failing.data.trackingCode
  });
  assert.equal(await stockOf(product.id), before - 1, "başarısız ödemenin stoğu iade edilir");
});

/* --------------------------------------------------------- kayıt ve giriş */

test("kayıt misafir sepetini hesaba taşır", opts, async () => {
  const guest = new Client(app.base);
  const product = await firstProduct(2);
  await guest.post("/api/cart/items", { productId: product.id, quantity: 2 });

  const email = `yeni${Date.now()}@example.com`;
  const register = await guest.post("/api/auth/register", {
    fullName: "Yeni Üye",
    email,
    password: "YeniUye2026x",
    phone: "0555 123 45 67"
  });

  assert.equal(register.status, 201);
  assert.equal(register.data.mergedCartItems, 1, "misafir sepeti kaybolmaz");

  const signedIn = new Client(app.base);
  assert.ok((await signedIn.signIn(email, "YeniUye2026x")).ok);
  assert.equal((await signedIn.get("/api/cart")).data.itemCount, 2, "sepet hesapta duruyor");
});

test("kayıt kuralları ve yinelenen e-posta", opts, async () => {
  const email = `tekrar${Date.now()}@example.com`;
  const body = { fullName: "Ali Veli", email, password: "GucluParola1" };

  assert.equal((await anon.post("/api/auth/register", body)).status, 201);
  assert.equal((await anon.post("/api/auth/register", body)).status, 409);
  assert.equal((await anon.post("/api/auth/register", { ...body, email: `x${Date.now()}@e.co`, password: "kisa1" })).status, 400);
  assert.equal((await anon.post("/api/auth/register", { ...body, email: "gecersiz" })).status, 400);
});

test("hatalı giriş aynı mesajı döndürür ve oturum açmaz", opts, async () => {
  const wrongPassword = await new Client(app.base).signIn("musteri@donanex.test", "YanlisParola1");
  const unknownUser = await new Client(app.base).signIn("hicyok@example.com", "YanlisParola1");

  assert.equal(wrongPassword.ok, false);
  assert.equal(unknownUser.ok, false);
  assert.equal(wrongPassword.reason, unknownUser.reason, "kayıtlı e-posta ele verilmez");
});

/* ----------------------------------------------------------- OAuth 2.1 */

test("yetkilendirme kodu akışı PKCE ile tamamlanır", opts, async () => {
  const client = new Client(app.base);
  const result = await client.signIn("musteri@donanex.test", DEMO_PASSWORD);

  assert.ok(result.ok, result.reason ?? "giris basarisiz");
  assert.ok(result.tokens.access_token);
  assert.ok(result.tokens.id_token, "openid istendiğinde id_token verilir");
  assert.equal(result.tokens.token_type, "Bearer");
  assert.equal(result.state, "test-state", "state geri döner");
  assert.ok(!result.tokens.refresh_token, "yenileme jetonu gövdede dönmez");
  assert.ok(client.cookies.dnx_rt, "yenileme jetonu HttpOnly çerezdedir");
});

test("PKCE doğrulayıcısı olmadan kod jetona çevrilemez", opts, async () => {
  const client = new Client(app.base);
  const verifier = crypto.randomBytes(48).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");

  const authorize = await client.get(
    `/oauth/authorize?response_type=code&client_id=donanex-web&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
      `&scope=openid&state=s&code_challenge=${challenge}&code_challenge_method=S256`
  );
  const authRequestId = new URL(header(authorize, "location")).searchParams.get("auth");
  const signIn = await client.post("/api/auth/sign-in", {
    email: "musteri@donanex.test",
    password: DEMO_PASSWORD,
    authRequestId
  });
  const code = new URL(signIn.data.redirectTo).searchParams.get("code");
  assert.ok(code !== null, "yonlendirmede yetkilendirme kodu yok");

  const wrongVerifier = await client.form("/oauth/token", {
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
    client_id: "donanex-web",
    code_verifier: crypto.randomBytes(48).toString("base64url")
  });
  assert.equal(wrongVerifier.status, 400);
  assert.equal(wrongVerifier.data.error, "invalid_request");

  // Doğru doğrulayıcı da artık çalışmaz: kod tek kullanımlıktır.
  const retry = await client.form("/oauth/token", {
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
    client_id: "donanex-web",
    code_verifier: verifier
  });
  assert.ok(retry.status >= 400, "tüketilen kod yeniden kullanılamaz");
});

test("authorize geçersiz istekleri reddeder", opts, async () => {
  const base = `/oauth/authorize?response_type=code&client_id=donanex-web&scope=openid&code_challenge_method=S256&code_challenge=${"a".repeat(43)}`;

  const badRedirect = await anon.get(`${base}&redirect_uri=${encodeURIComponent("https://evil.test/callback")}`);
  assert.equal(badRedirect.status, 400, "kayıtlı olmayan redirect_uri reddedilir");
  assert.equal(badRedirect.headers.get("location"), null, "doğrulanmadan yönlendirme yapılmaz");

  const plain = await anon.get(
    `/oauth/authorize?response_type=code&client_id=donanex-web&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=openid&code_challenge=x&code_challenge_method=plain`
  );
  assert.equal(plain.status, 400, "düz PKCE kabul edilmez");

  const token = await anon.get(
    `/oauth/authorize?response_type=token&client_id=donanex-web&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=openid&code_challenge_method=S256&code_challenge=${"a".repeat(43)}`
  );
  assert.equal(token.status, 400, "örtük akış kapalı");

  const unknownClient = await anon.get(`${base.replace("donanex-web", "uydurma")}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`);
  assert.equal(unknownClient.status, 400);
});

test("yenileme jetonu döner ve tekrar kullanımı oturumu kapatır", opts, async () => {
  const client = new Client(app.base);
  assert.ok((await client.signIn("ahmet@donanex.test", DEMO_PASSWORD)).ok);
  const stolen = client.cookies.dnx_rt;

  const refreshed = await client.form("/oauth/token", { grant_type: "refresh_token", client_id: "donanex-web" });
  assert.equal(refreshed.status, 200);
  assert.ok(refreshed.data.access_token);
  assert.notEqual(client.cookies.dnx_rt, stolen, "yenileme jetonu döndürülür");

  // Çalınan eski jeton kullanılırsa tüm zincir iptal edilir.
  const thief = new Client(app.base);
  const reuse = await thief.form("/oauth/token", {
    grant_type: "refresh_token",
    client_id: "donanex-web",
    refresh_token: stolen
  });
  assert.equal(reuse.status, 401);

  const afterReuse = await client.form("/oauth/token", { grant_type: "refresh_token", client_id: "donanex-web" });
  assert.equal(afterReuse.status, 401, "hırsızlık tespit edilince aile iptal edilir");
});

test("çıkış oturumu sunucuda iptal eder", opts, async () => {
  const client = new Client(app.base);
  await client.signIn("musteri@donanex.test", DEMO_PASSWORD);
  const stolenRefresh = client.cookies.dnx_rt;

  assert.equal((await client.get("/api/me")).status, 200);
  await client.post("/api/auth/sign-out");

  const thief = new Client(app.base);
  const reuse = await thief.form("/oauth/token", {
    grant_type: "refresh_token",
    client_id: "donanex-web",
    refresh_token: stolenRefresh
  });
  assert.equal(reuse.status, 401, "çalınmış jeton çıkıştan sonra işe yaramaz");
});

test("jeton olmadan ve sahte jetonla korunan uçlara girilemez", opts, async () => {
  for (const path of ["/api/me", "/api/me/orders", "/api/admin/dashboard", "/api/me/addresses"]) {
    assert.equal((await anon.get(path)).status, 401, path);
  }

  const forged = new Client(app.base);
  forged.accessToken = "sahte.jeton.degeri";
  assert.equal((await forged.get("/api/me")).status, 401);
});

/* ------------------------------------------------- rol ve yetki sınırları */

test("müşteri yönetim ve mağaza panellerine giremez", opts, async () => {
  const customer = new Client(app.base);
  assert.ok((await customer.signIn("musteri@donanex.test", DEMO_PASSWORD)).ok);

  const me = await customer.get("/api/me");
  assert.deepEqual(me.data.roles, ["CUSTOMER"]);
  assert.equal(me.data.isSystemAdmin, false);
  assert.deepEqual(me.data.stores, []);

  const stores = await anon.get("/api/storefront/stores");
  const storeId = (await new Client(app.base).get("/api/storefront/stores")).data.items[0].id;

  assert.equal((await customer.get("/api/admin/dashboard")).status, 403);
  assert.equal((await customer.get("/api/admin/users")).status, 403);
  assert.equal((await customer.get(`/api/stores/${storeId}/products`)).status, 403);
  assert.equal((await customer.post(`/api/stores/${storeId}/products`, {})).status, 403);
  assert.ok(stores.data.items.length > 0);
});

test("mağaza sahibi yalnızca kendi mağazasını yönetir", opts, async () => {
  const owner = new Client(app.base);
  assert.ok((await owner.signIn("teknoloji@donanex.test", DEMO_PASSWORD)).ok);

  const me = await owner.get("/api/me");
  assert.deepEqual(me.data.roles, ["CUSTOMER", "STORE_OWNER"].filter((role) => me.data.roles.includes(role)));
  const myStore = me.data.stores[0];
  assert.ok(myStore);

  const allStores = (await anon.get("/api/storefront/stores")).data.items;
  const foreign = allStores.find((store: Row) => store.id !== myStore.id);

  assert.equal((await owner.get(`/api/stores/${myStore.id}/products`)).status, 200);
  assert.equal((await owner.get(`/api/stores/${foreign.id}/products`)).status, 403);
  assert.equal((await owner.get(`/api/stores/${foreign.id}/orders`)).status, 403);
  assert.equal((await owner.get(`/api/stores/${foreign.id}/dashboard`)).status, 403);
  assert.equal(
    (await owner.post(`/api/stores/${foreign.id}/products`, {
      name: "x",
      description: "d",
      price: "1",
      stock: 1,
      imageUrl: "/images/a.png"
    })).status,
    403,
    "başka mağazaya ürün eklenemez"
  );
  assert.equal((await owner.get("/api/admin/users")).status, 403);
});

test("mağaza çalışanı ürün işler ama mağaza ayarlarına dokunamaz", opts, async () => {
  const staff = new Client(app.base);
  assert.ok((await staff.signIn("calisan@donanex.test", DEMO_PASSWORD)).ok);

  const me = await staff.get("/api/me");
  const storeId = me.data.stores[0].id;

  assert.equal((await staff.get(`/api/stores/${storeId}/products`)).status, 200);
  assert.equal((await staff.get(`/api/stores/${storeId}/orders`)).status, 200);
  assert.equal((await staff.put(`/api/stores/${storeId}`, {})).status, 403, "mağaza ayarı değiştiremez");
  assert.equal((await staff.get(`/api/stores/${storeId}/members`)).status, 403, "çalışan yönetemez");
});

/* ------------------------------------------------------- mağaza paneli */

test("mağaza ürün yaşam döngüsünü yönetir", opts, async () => {
  const owner = new Client(app.base);
  await owner.signIn("oyuncu@donanex.test", DEMO_PASSWORD);
  const storeId = (await owner.get("/api/me")).data.stores[0].id;

  const body = {
    name: "Panel Testi Ürünü",
    description: "Entegrasyon testinde eklendi.",
    price: "149.90",
    stock: 4,
    imageUrl: "/images/urunler/ssd.png",
    status: "draft"
  };

  const created = await owner.post(`/api/stores/${storeId}/products`, body);
  assert.equal(created.status, 201);
  assert.equal(created.data.status, "draft");

  // Taslak ürün vitrinde görünmez.
  assert.equal((await anon.get(`/api/products?q=Panel Testi`)).data.total, 0);

  await owner.patch(`/api/stores/${storeId}/products/${created.data.id}/status`, { status: "active" });
  assert.equal((await anon.get(`/api/products?q=Panel Testi`)).data.total, 1, "yayına alınınca vitrinde görünür");

  const updated = await owner.put(`/api/stores/${storeId}/products/${created.data.id}`, { ...body, stock: 9, status: "active" });
  assert.equal(updated.data.stock, 9);

  assert.equal(
    (await owner.post(`/api/stores/${storeId}/products`, { ...body, imageUrl: "javascript:alert(1)" })).status,
    400,
    "zararlı görsel adresi reddedilir"
  );

  const deleted = await owner.delete(`/api/stores/${storeId}/products/${created.data.id}`);
  assert.equal(deleted.data.archived, false, "hiç satılmamış ürün silinir");
  assert.equal((await owner.delete(`/api/stores/${storeId}/products/${created.data.id}`)).status, 404);
});

test("satılmış ürün silinmez, arşivlenir", opts, async () => {
  const owner = new Client(app.base);
  await owner.signIn("oyuncu@donanex.test", DEMO_PASSWORD);
  const storeId = (await owner.get("/api/me")).data.stores[0].id;

  const created = await owner.post(`/api/stores/${storeId}/products`, {
    name: "Satılmış Ürün",
    description: "Sipariş sonrası arşivlenir.",
    price: "99.00",
    stock: 5,
    imageUrl: "/images/urunler/ssd.png",
    status: "active"
  });

  await placeGuestOrder(new Client(app.base), created.data.id);

  const deleted = await owner.delete(`/api/stores/${storeId}/products/${created.data.id}`);
  assert.equal(deleted.data.archived, true, "sipariş geçmişi korunur");
  assert.equal((await anon.get("/api/products?q=Satılmış Ürün")).data.total, 0, "arşivli ürün vitrinde yok");
});

test("CSV toplu içe aktarma hep ya da hiç çalışır", opts, async () => {
  const owner = new Client(app.base);
  await owner.signIn("komponent@donanex.test", DEMO_PASSWORD);
  const storeId = (await owner.get("/api/me")).data.stores[0].id;
  const before = (await owner.get(`/api/stores/${storeId}/products`)).data.total;

  const broken = await owner.post(`/api/stores/${storeId}/products/bulk`, {
    products: [{ name: "Geçerli", price: 10 }, { name: "", price: 5 }]
  });
  assert.equal(broken.status, 400);
  assert.match(broken.data.message, /3\. satır/, "hatalı satır numarası bildirilir");
  assert.equal((await owner.get(`/api/stores/${storeId}/products`)).data.total, before, "hiçbiri eklenmez");

  const ok = await owner.post(`/api/stores/${storeId}/products/bulk`, {
    products: [{ name: "CSV Ürün 1", price: 10 }, { name: "CSV Ürün 2", price: 20, stock: 4 }]
  });
  assert.equal(ok.data.count, 2);
  assert.equal((await owner.get(`/api/stores/${storeId}/products`)).data.total, before + 2);
});

test("mağaza siparişi hazırlar, kargolar ve müşteri bilgilendirilir", opts, async () => {
  const owner = new Client(app.base);
  await owner.signIn("oyuncu@donanex.test", DEMO_PASSWORD);
  const storeId = (await owner.get("/api/me")).data.stores[0].id;

  const products = (await owner.get(`/api/stores/${storeId}/products?status=active`)).data.items;
  const product = products.find((item: Row) => item.stock > 0);

  const guest = new Client(app.base);
  const order = await placeGuestOrder(guest, product.id);
  await guest.post(`/api/orders/${order.data.orderId}/payment`, {
    outcome: "success",
    trackingCode: order.data.trackingCode
  });

  const list = await owner.get(`/api/stores/${storeId}/orders?q=${order.data.orderNumber}`);
  assert.equal(list.data.total, 1);
  const packageId = list.data.items[0].packageId;

  assert.equal((await owner.patch(`/api/stores/${storeId}/orders/${packageId}/status`, { status: "delivered" })).status, 409, "basamak atlanamaz");
  assert.equal((await owner.patch(`/api/stores/${storeId}/orders/${packageId}/status`, { status: "preparing" })).status, 200);

  const shipping = await owner.patch(`/api/stores/${storeId}/orders/${packageId}/shipping`, {
    carrier: "Yurtiçi Kargo",
    trackingNumber: "YK-123",
    trackingUrl: "https://kargo.test/YK-123"
  });
  assert.equal(shipping.data.trackingNumber, "YK-123");
  assert.equal(
    (await owner.patch(`/api/stores/${storeId}/orders/${packageId}/shipping`, { trackingUrl: "javascript:alert(1)" })).status,
    400
  );

  await owner.patch(`/api/stores/${storeId}/orders/${packageId}/status`, { status: "shipped" });

  const tracked = await anon.post("/api/orders/track", {
    orderNumber: order.data.orderNumber,
    trackingCode: order.data.trackingCode
  });
  assert.equal(tracked.data.packages[0].status, "shipped");
  assert.equal(tracked.data.packages[0].trackingNumber, "YK-123");
});

/* ---------------------------------------------------- müşteri hesabı */

test("müşteri profilini, adresini ve siparişlerini yönetir", opts, async () => {
  const email = `hesap${Date.now()}@example.com`;
  const client = new Client(app.base);
  await client.post("/api/auth/register", { fullName: "Hesap Testi", email, password: "HesapTest2026" });
  assert.ok((await client.signIn(email, "HesapTest2026")).ok);

  assert.equal((await client.put("/api/me/profile", { fullName: "Yeni Ad" })).data.fullName, "Yeni Ad");

  const address = await client.post("/api/me/addresses", {
    title: "Ev",
    fullName: "Hesap Testi",
    phone: "0555 999 88 77",
    city: "İzmir",
    district: "Konak",
    line: "Adres satırı"
  });
  assert.equal(address.status, 201);
  assert.equal((await client.get("/api/me/addresses")).data.items.length, 1);
  assert.equal((await client.delete(`/api/me/addresses/${address.data.id}`)).status, 204);

  // Başkasının adresi silinemez.
  const other = new Client(app.base);
  await other.signIn("musteri@donanex.test", DEMO_PASSWORD);
  const otherAddress = await other.post("/api/me/addresses", {
    title: "Ev",
    fullName: "Müşteri",
    phone: "0555 111 22 33",
    city: "İstanbul",
    district: "Kadıköy",
    line: "Adres"
  });
  assert.equal((await client.delete(`/api/me/addresses/${otherAddress.data.id}`)).status, 404);
});

test("müşteri yalnızca kendi siparişini görür ve iptal eder", opts, async () => {
  const product = await firstProduct(2);

  const buyer = new Client(app.base);
  await buyer.signIn("musteri@donanex.test", DEMO_PASSWORD);
  await buyer.post("/api/cart/items", { productId: product.id, quantity: 1 });
  const order = await buyer.post("/api/orders", checkout());

  const other = new Client(app.base);
  await other.signIn("ahmet@donanex.test", DEMO_PASSWORD);

  assert.equal((await other.get(`/api/me/orders/${order.data.orderId}`)).status, 404, "başkasının siparişi görünmez");
  assert.equal((await other.post(`/api/me/orders/${order.data.orderId}/cancel`)).status, 404);

  const mine = await buyer.get(`/api/me/orders/${order.data.orderId}`);
  assert.equal(mine.status, 200);
  assert.equal(mine.data.packages[0].items.length, 1);

  const before = await stockOf(product.id);
  assert.equal((await buyer.post(`/api/me/orders/${order.data.orderId}/cancel`)).status, 200);
  assert.equal(await stockOf(product.id), before + 1, "iptal stoğu iade eder");
});

test("parola değişimi diğer oturumları kapatır", opts, async () => {
  const email = `parola${Date.now()}@example.com`;
  await anon.post("/api/auth/register", { fullName: "Parola Testi", email, password: "EskiParola1" });

  const phone = new Client(app.base);
  const laptop = new Client(app.base);
  assert.ok((await phone.signIn(email, "EskiParola1")).ok);
  assert.ok((await laptop.signIn(email, "EskiParola1")).ok);

  assert.equal((await phone.put("/api/me/password", { currentPassword: "yanlis", newPassword: "YeniParola1" })).status, 401);
  assert.equal((await phone.put("/api/me/password", { currentPassword: "EskiParola1", newPassword: "kisa" })).status, 400);
  assert.equal((await phone.put("/api/me/password", { currentPassword: "EskiParola1", newPassword: "YeniParola1" })).status, 200);

  // Diğer cihazın erişim jetonu oturum sürümü arttığı için geçersizdir.
  assert.equal((await laptop.get("/api/me")).status, 401);
  assert.equal((await new Client(app.base).signIn(email, "EskiParola1")).ok, false);
  assert.equal((await new Client(app.base).signIn(email, "YeniParola1")).ok, true);
});

test("parola sıfırlama tek kullanımlıktır ve hesap varlığını ele vermez", opts, async () => {
  const email = `sifirla${Date.now()}@example.com`;
  await anon.post("/api/auth/register", { fullName: "Sıfırlama", email, password: "EskiParola9" });

  const known = await anon.post("/api/auth/password/forgot", { email });
  const unknown = await anon.post("/api/auth/password/forgot", { email: "kayitsiz@example.com" });
  assert.deepEqual(known.data, unknown.data, "yanıt e-postanın kayıtlı olduğunu söylemez");

  const mail = await app.outbox.waitFor((message) => message.to === email && message.subject.includes("Parola"));
  assert.ok(mail, "sıfırlama e-postası gönderilir");
  assert.ok(!app.outbox.messages.some((message) => message.to === "kayitsiz@example.com"));

  const token = mail.text.match(/#token=([a-f0-9]{64})/)[1];
  assert.ok(mail.text.includes("/parola-sifirla#token="), "jeton adres parçasında taşınır");

  const stored = await app.pool.query("SELECT token_hash FROM verification_tokens WHERE purpose = 'password_reset'");
  assert.ok(stored.rows.every((row) => row.token_hash !== token), "açık jeton veritabanında tutulmaz");

  assert.equal((await anon.post("/api/auth/password/reset", { token: "0".repeat(64), password: "YeniSifre12" })).status, 400);
  assert.equal((await anon.post("/api/auth/password/reset", { token, password: "kisa" })).status, 400);
  assert.equal((await anon.post("/api/auth/password/reset", { token, password: "YeniSifre12" })).status, 200);
  assert.equal((await anon.post("/api/auth/password/reset", { token, password: "BaskaSifre12" })).status, 400, "tek kullanımlık");

  assert.equal((await new Client(app.base).signIn(email, "YeniSifre12")).ok, true);
});

/* ------------------------------------------------------- mağaza başvurusu */

test("başvuru onaylanınca mağaza sahibi yetkisi verilir", opts, async () => {
  const email = `satici${Date.now()}@example.com`;
  const applicant = new Client(app.base);
  await applicant.post("/api/auth/register", { fullName: "Aday Satıcı", email, password: "AdaySatici1" });
  await applicant.signIn(email, "AdaySatici1");

  const application = await applicant.post("/api/me/store-application", {
    name: `Test Mağaza ${Date.now()}`,
    description: "Entegrasyon testinde açıldı.",
    contactEmail: email,
    phone: "0555 444 33 22"
  });
  assert.equal(application.status, 201);
  const storeId = application.data.store.id;
  assert.equal(application.data.store.status, "pending");

  // Onaydan önce ne panel ne de ürün ekleme açıktır.
  assert.equal((await applicant.get(`/api/stores/${storeId}/products`)).status, 403);
  assert.equal((await anon.get(`/api/storefront/stores/${application.data.store.slug}`)).status, 404);

  const admin = new Client(app.base);
  assert.ok((await admin.signIn(ADMIN_EMAIL, ADMIN_PASSWORD)).ok);
  assert.equal((await admin.patch(`/api/admin/stores/${storeId}/status`, { status: "active" })).status, 200);

  // Yetki önbelleği temizlendiği için yeni rol hemen geçerli olur.
  const refreshed = new Client(app.base);
  await refreshed.signIn(email, "AdaySatici1");
  const me = await refreshed.get("/api/me");
  assert.ok(me.data.stores.some((store: Row) => store.id === storeId), "mağaza panelde görünür");
  assert.equal((await refreshed.get(`/api/stores/${storeId}/products`)).status, 200);

  const approval = await app.outbox.waitFor((message) => message.subject.includes("onaylandı"));
  assert.ok(approval, "onay e-postası gönderilir");
});

/* ------------------------------------------------------ yönetim paneli */

test("sistem yöneticisi panoyu, mağazaları ve kullanıcıları yönetir", opts, async () => {
  const admin = new Client(app.base);
  assert.ok((await admin.signIn(ADMIN_EMAIL, ADMIN_PASSWORD)).ok);

  const dashboard = await admin.get("/api/admin/dashboard");
  assert.equal(dashboard.status, 200);
  assert.ok(dashboard.data.activeStores >= 4);
  assert.equal(dashboard.data.last14Days.length, 14);

  assert.ok((await admin.get("/api/admin/stores")).data.total >= 4);
  assert.ok((await admin.get("/api/admin/users")).data.total >= 5);
  assert.ok((await admin.get("/api/admin/orders")).data.total > 0);
  assert.equal((await admin.get("/api/admin/tickets")).status, 200);

  const orders = await admin.get("/api/admin/orders?pageSize=1");
  const detail = await admin.get(`/api/admin/orders/${orders.data.items[0].id}`);
  assert.equal(detail.status, 200);
  assert.ok(Array.isArray(detail.data.payments));
});

test("yönetici hesabı askıya alır ve son yöneticiyi koruyan kural çalışır", opts, async () => {
  const admin = new Client(app.base);
  await admin.signIn(ADMIN_EMAIL, ADMIN_PASSWORD);

  const email = `askiya${Date.now()}@example.com`;
  const victim = new Client(app.base);
  await victim.post("/api/auth/register", { fullName: "Askıya Alınacak", email, password: "AskiTest2026" });
  await victim.signIn(email, "AskiTest2026");
  assert.equal((await victim.get("/api/me")).status, 200);

  const users = await admin.get(`/api/admin/users?q=${encodeURIComponent(email)}`);
  const userId = users.data.items[0].id;

  assert.equal((await admin.patch(`/api/admin/users/${userId}/status`, { status: "suspended" })).status, 200);
  assert.equal((await victim.get("/api/me")).status, 403, "askıya alınan kullanıcı erişemez");
  assert.equal((await new Client(app.base).signIn(email, "AskiTest2026")).ok, false);

  await admin.patch(`/api/admin/users/${userId}/status`, { status: "active" });
  assert.equal((await new Client(app.base).signIn(email, "AskiTest2026")).ok, true);

  // Kendi hesabını askıya alamaz, son yöneticinin rolünü kaldıramaz.
  const self = (await admin.get(`/api/admin/users?q=${encodeURIComponent(ADMIN_EMAIL)}`)).data.items[0];
  assert.equal((await admin.patch(`/api/admin/users/${self.id}/status`, { status: "suspended" })).status, 409);
  assert.equal(
    (await admin.post(`/api/admin/users/${self.id}/roles`, { roleCode: "SYSTEM_ADMIN", revoke: true })).status,
    409
  );
});

test("askıya alınan mağazanın ürünleri vitrinden düşer", opts, async () => {
  const admin = new Client(app.base);
  await admin.signIn(ADMIN_EMAIL, ADMIN_PASSWORD);

  const stores = await admin.get("/api/admin/stores?status=active");
  const store = stores.data.items.find((item: Row) => item.productCount > 0);
  const before = (await anon.get(`/api/products?store=${store.slug}`)).data.total;
  assert.ok(before > 0);

  await admin.patch(`/api/admin/stores/${store.id}/status`, { status: "suspended" });
  assert.equal((await anon.get(`/api/products?store=${store.slug}`)).data.total, 0);
  assert.equal((await anon.get(`/api/storefront/stores/${store.slug}`)).status, 404);

  await admin.patch(`/api/admin/stores/${store.id}/status`, { status: "active" });
  assert.equal((await anon.get(`/api/products?store=${store.slug}`)).data.total, before, "geri alınır");
});

/* ------------------------------------------------------------- destek */

test("destek talebi kayıtsız açılır; yanıt yalnızca metin varsa e-posta gönderir", opts, async () => {
  const email = `destek${Date.now()}@example.com`;
  const created = await anon.post("/api/support/tickets", {
    fullName: "Destek Testi",
    email,
    subject: "Kargo sorusu",
    message: "<img src=x onerror=alert(1)> Siparişim ne zaman çıkar?"
  });
  assert.equal(created.status, 201);
  assert.match(created.data.reference, /^DT-\d{6}$/);

  const admin = new Client(app.base);
  await admin.signIn(ADMIN_EMAIL, ADMIN_PASSWORD);
  const ticketId = created.data.id;

  const statusOnly = await admin.put(`/api/admin/tickets/${ticketId}`, { status: "in_progress" });
  assert.equal(statusOnly.data.emailQueued, false, "durum değişikliği e-posta göndermez");

  const replied = await admin.put(`/api/admin/tickets/${ticketId}`, {
    status: "answered",
    body: "Siparişiniz yarın kargoya verilecek."
  });
  assert.equal(replied.data.emailQueued, true);

  const mail = await app.outbox.waitFor((message) => message.to === email && message.subject.includes("yanıt"));
  assert.ok(mail);
  assert.equal((await anon.post("/api/support/tickets", { fullName: "A", email: "gecersiz", subject: "s", message: "m" })).status, 400);
});

/* -------------------------------------------------------- dayanıklılık */

test("bozuk istekler 500 üretmez ve iç ayrıntı sızdırmaz", opts, async () => {
  const broken = await fetch(`${app.base}/api/auth/sign-in`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{bozuk"
  });
  assert.equal(broken.status, 400);

  const huge = await anon.post("/api/support/tickets", {
    fullName: "A",
    email: "a@b.co",
    subject: "s",
    message: "x".repeat(200_000)
  });
  assert.equal(huge.status, 413);

  assert.equal((await anon.get("/api/boyle-bir-uc-yok")).status, 404);
  assert.equal((await anon.get("/api/me/orders/not-a-uuid")).status, 401);

  const serverError = await anon.get("/api/products?page=abc&pageSize=-5");
  assert.equal(serverError.status, 200, "bozuk sayfalama varsayılana düşer");
});

test("CSRF: yabancı Origin ve cross-site istekler reddedilir", opts, async () => {
  const body = { fullName: "A", email: "a@b.co", subject: "s", message: "m" };

  assert.equal((await anon.post("/api/support/tickets", body, { Origin: "https://kotu.test" })).status, 403);
  assert.equal((await anon.post("/api/support/tickets", body, { "Sec-Fetch-Site": "cross-site" })).status, 403);
  assert.equal((await anon.post("/api/support/tickets", body, { Origin: app.base })).status, 201, "aynı kaynak geçer");
  assert.equal((await anon.get("/api/products", { Origin: "https://kotu.test" })).status, 200, "okuma engellenmez");
});

test("hız sınırı hatalı girişleri durdurur", opts, async () => {
  const limited = new Client(app.limitedBase);
  const statuses = [];

  for (let attempt = 0; attempt < 13; attempt++) {
    const response = await limited.post("/api/auth/sign-in", {
      email: "musteri@donanex.test",
      password: "YanlisParola1"
    });
    statuses.push(response.status);
  }

  assert.ok(statuses.includes(429), "bir noktada sınıra takılmalı");
  assert.equal(statuses[0], 401, "ilk denemeler normal hata döner");
});

test("her yanıt istek numarası taşır", opts, async () => {
  const response = await anon.get("/api/products");
  assert.match(header(response, "x-request-id"), /[0-9a-f-]{36}/);
});

/* ------------------------------------------------------------------ */
/* Ürün görseli yükleme                                                */
/* ------------------------------------------------------------------ */

// 1x1 saydam PNG — gerçek sihirli sayıyı taşıyan en küçük geçerli dosya.
const GECERLI_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);

test("yüklenen görsel saklanır, sunulur ve ürüne bağlanabilir", opts, async () => {
  const owner = new Client(app.base);
  assert.ok((await owner.signIn("teknoloji@donanex.test", DEMO_PASSWORD)).ok);
  const storeId = (await owner.get("/api/me")).data.stores[0].id;

  const yukleme = await owner.upload(`/api/stores/${storeId}/gorseller`, GECERLI_PNG, "image/png");
  assert.equal(yukleme.status, 201);
  assert.match(
    yukleme.data.imageUrl,
    /^\/yuklenen\/[0-9a-f]{32}\.png$/,
    "dosya adı sunucuda üretilir; kullanıcıdan gelen hiçbir şey yola girmez"
  );

  // Görsel oturum olmadan da açılabilmeli: vitrinde <img src> ile çağrılıyor.
  const gorsel = await fetch(`${app.base}${yukleme.data.imageUrl}`);
  assert.equal(gorsel.status, 200);
  assert.equal(gorsel.headers.get("content-type"), "image/png");
  assert.equal(gorsel.headers.get("x-content-type-options"), "nosniff");

  const urun = await owner.post(`/api/stores/${storeId}/products`, {
    name: "Görselli Test Ürünü",
    description: "Yüklenen görselle oluşturuldu.",
    price: "1234.50",
    stock: 3,
    imageUrl: yukleme.data.imageUrl
  });
  assert.equal(urun.status, 201, "yüklenen adres ürün kaydında kabul edilir");
});

test("görsel yükleme sahte dosyayı ve yabancı mağazayı reddeder", opts, async () => {
  const owner = new Client(app.base);
  assert.ok((await owner.signIn("teknoloji@donanex.test", DEMO_PASSWORD)).ok);
  const storeId = (await owner.get("/api/me")).data.stores[0].id;

  // "image/png" diyor ama içerik HTML: sihirli sayı tutmadığı için reddedilir.
  const sahte = await owner.upload(
    `/api/stores/${storeId}/gorseller`,
    Buffer.from("<script>alert(1)</script>", "utf8"),
    "image/png"
  );
  assert.equal(sahte.status, 400, "içerik türü baytlardan doğrulanır, başlıktan değil");

  // İzin verilmeyen tür kapıda durdurulur.
  const metin = await owner.upload(`/api/stores/${storeId}/gorseller`, Buffer.from("merhaba"), "text/plain");
  assert.equal(metin.status, 415);

  // Başka mağazanın numarasıyla yükleme yapılamaz.
  const yabanci = (await anon.get("/api/storefront/stores")).data.items.find((store: Row) => store.id !== storeId);
  const izinsiz = await owner.upload(`/api/stores/${yabanci.id}/gorseller`, GECERLI_PNG, "image/png");
  assert.equal(izinsiz.status, 403);

  // Uydurma dosya adı diske hiç gitmez.
  const yok = await fetch(`${app.base}/yuklenen/..%2F..%2Fetc%2Fpasswd`);
  assert.equal(yok.status, 404);
});
