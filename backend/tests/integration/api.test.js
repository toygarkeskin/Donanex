"use strict";

/**
 * Gerçek PostgreSQL ile uçtan uca API testi. TEST_DB_HOST verilmezse atlanır:
 *   docker compose -f docker-compose.test.yml up --build --abort-on-container-exit
 *
 * E-posta her zaman sahte posta kutusuna gider; gerçek SMTP'ye hiçbir şey gönderilmez.
 */
const test = require("node:test");
const assert = require("node:assert/strict");

const { createPool, waitForDatabase } = require("../../src/infrastructure/persistence/postgres/pool");
const { runMigrations } = require("../../src/infrastructure/persistence/postgres/migrate");
const { seedProductsIfEmpty } = require("../../src/infrastructure/persistence/postgres/seed");
const { buildContainer } = require("../../src/bootstrap/container");
const { createApp } = require("../../src/presentation/http/app");
const { ExpireUnpaidOrdersCommand } = require("../../src/application/ordering");

const enabled = Boolean(process.env.TEST_DB_HOST);
const opts = { skip: enabled ? false : "TEST_DB_HOST tanımlı değil" };

const ADMIN = { username: "yonetici", password: "test-yonetici-parolasi-123" };
const CUSTOMER = { name: "Test Müşteri", email: "musteri@example.com", password: "Parola1234" };

const config = {
  port: 0,
  isProduction: false,
  trustProxy: false,
  cookieSecure: false,
  testPaymentsEnabled: true,
  publicUrl: "http://site.test",
  orderPaymentTtlMinutes: 60,
  admin: ADMIN,
  sessionSecret: "t".repeat(48),
  smtp: {}
};

let pool, server, base, container;
const outbox = [];

class Client {
  constructor() {
    this.cookies = {};
  }
  async call(method, path, body, headers = {}) {
    const cookie = Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join("; ");
    const response = await fetch(`${base}/api${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
        ...headers
      },
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
    for (const raw of response.headers.getSetCookie()) {
      const [pair] = raw.split(";");
      const index = pair.indexOf("=");
      const value = pair.slice(index + 1);
      if (value) this.cookies[pair.slice(0, index)] = value;
      else delete this.cookies[pair.slice(0, index)];
    }
    const text = await response.text();
    let data = {};
    try {
      data = JSON.parse(text);
    } catch {
      /* JSON değil */
    }
    return { status: response.status, data, headers: response.headers, rawCookies: response.headers.getSetCookie() };
  }
  get(path, headers) {
    return this.call("GET", path, undefined, headers);
  }
  post(path, body = {}, headers) {
    return this.call("POST", path, body, headers);
  }
  put(path, body = {}) {
    return this.call("PUT", path, body);
  }
  patch(path, body = {}) {
    return this.call("PATCH", path, body);
  }
  delete(path) {
    return this.call("DELETE", path);
  }
}

const admin = new Client();
const anon = new Client();

const checkout = (items, extra = {}) => ({
  fullName: "Ali Veli",
  email: "ali@example.com",
  phone: "05550000000",
  address: "İstanbul",
  items,
  ...extra
});

async function firstProduct(stock = 1) {
  const { data } = await anon.get("/products");
  return data.products.find((p) => p.stock >= stock);
}
const stockOf = async (id) => (await anon.get(`/products?ids=${id}`)).data.products[0].stock;

test.before(async () => {
  if (!enabled) return;
  pool = createPool({
    host: process.env.TEST_DB_HOST,
    port: Number(process.env.TEST_DB_PORT || 5432),
    database: process.env.TEST_DB_NAME,
    user: process.env.TEST_DB_USER,
    password: process.env.TEST_DB_PASSWORD
  });
  await waitForDatabase(pool);
  await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  await runMigrations(pool, () => {});
  await seedProductsIfEmpty(pool, () => {});

  container = buildContainer(
    { pool, config },
    { mailer: { send: async (mail) => (outbox.push(mail), true) } }
  );
  const app = createApp({ commands: container.commands, queries: container.queries, config, rateLimits: false, log: () => {} });
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;

  assert.equal((await admin.post("/admin/login", ADMIN)).status, 200);
});

test.after(async () => {
  if (!enabled) return;
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
});

test("Sağlık uçları çalışır, güvenlik başlıkları vardır", opts, async () => {
  const health = await anon.get("/health");
  assert.equal(health.status, 200);
  assert.equal((await anon.get("/ready")).status, 200);
  assert.equal(health.headers.get("x-powered-by"), null);
  assert.equal(health.headers.get("x-content-type-options"), "nosniff");
  assert.match(health.headers.get("content-security-policy"), /default-src 'none'/);
  assert.equal((await anon.get("/products")).headers.get("cache-control"), "no-store");
  assert.equal((await anon.get("/db-test")).status, 404, "eski tanılama ucu kaldırıldı");
});

test("Vitrin: arama, kategori ve kimlik filtresi; SQL enjeksiyonu etkisiz", opts, async () => {
  const all = (await anon.get("/products")).data.products;
  assert.ok(all.length >= 4);

  const laptops = (await anon.get("/products?category=Laptop")).data.products;
  assert.ok(laptops.length > 0 && laptops.every((p) => p.category === "Laptop"));

  assert.ok((await anon.get("/products?q=logitech")).data.products.length > 0);
  assert.equal((await anon.get(`/products?q=${encodeURIComponent("' OR 1=1 --")}`)).data.products.length, 0);
  assert.equal((await anon.get(`/products?q=${encodeURIComponent("%")}`)).data.products.length, 0, "joker kaçırılır");
  assert.equal((await anon.get("/products?ids=abc")).data.products.length, 0);
  assert.equal((await anon.get("/products?ids=99999999999")).status, 200);
  assert.ok((await anon.get("/product-categories")).data.categories.includes("Laptop"));
});

test("Yetkisiz kullanıcı yönetici ve müşteri uçlarına erişemez", opts, async () => {
  for (const path of ["/admin/stats", "/admin/products", "/admin/orders", "/admin/support", "/admin/support/1"]) {
    assert.equal((await anon.get(path)).status, 401, path);
  }
  assert.equal((await anon.post("/admin/products", {})).status, 401);
  assert.equal((await anon.delete("/admin/products/1")).status, 401);
  assert.equal((await anon.patch("/admin/orders/1/status", { status: "İptal edildi" })).status, 401);
  for (const path of ["/customers/address", "/customers/orders"]) {
    assert.equal((await anon.get(path)).status, 401, path);
  }
  assert.equal((await anon.post("/customers/orders/1/cancel")).status, 401);
});

test("Müşteri belirteci yönetici çerezi olarak kullanılamaz; sahte çerez reddedilir", opts, async () => {
  const c = new Client();
  await c.post("/customers/register", { ...CUSTOMER, email: "cerez@example.com" });
  await c.post("/customers/login", { email: "cerez@example.com", password: CUSTOMER.password });
  const hacker = new Client();
  hacker.cookies.admin_session = c.cookies.customer_session;
  assert.equal((await hacker.get("/admin/stats")).status, 401);
  hacker.cookies.admin_session = "e30.sahte";
  assert.equal((await hacker.get("/admin/stats")).status, 401);
});

test("Çerezler HttpOnly ve SameSite=Strict'tir", opts, async () => {
  const c = new Client();
  const { rawCookies } = await c.post("/admin/login", ADMIN);
  assert.match(rawCookies[0], /HttpOnly/);
  assert.match(rawCookies[0], /SameSite=Strict/);
});

test("Başka siteden gelen istek (CSRF) reddedilir", opts, async () => {
  const body = { email: "x@y.co", password: "z" };
  const evil = await anon.post("/customers/login", body, { Origin: "https://kotu-site.test" });
  assert.equal(evil.status, 403);
  const crossSite = await anon.post("/customers/login", body, { "Sec-Fetch-Site": "cross-site" });
  assert.equal(crossSite.status, 403);
  const same = await anon.post("/customers/login", body, { Origin: base });
  assert.equal(same.status, 401, "aynı kaynak geçer ve kimlik denetimine ulaşır");
});

test("Sipariş: tutar sunucuda hesaplanır, istemci fiyatı yok sayılır, stok düşer", opts, async () => {
  const product = await firstProduct(2);
  const before = product.stock;
  const { status, data } = await anon.post(
    "/orders",
    checkout([{ productId: product.id, quantity: 2, price: 0.01 }], { total: 0.01 })
  );
  assert.equal(status, 201);
  assert.equal(Number(data.total), Number(product.price) * 2);
  assert.match(data.trackingCode, /^[a-f0-9]{48}$/);
  assert.equal(await stockOf(product.id), before - 2);
});

test("Sipariş: stoktan fazlası ve geçersiz girdi reddedilir", opts, async () => {
  const product = await firstProduct();
  const over = await anon.post("/orders", checkout([{ productId: product.id, quantity: 99 }]));
  assert.equal(over.status, 409);
  assert.equal((await anon.post("/orders", checkout([{ productId: 2147483648, quantity: 1 }]))).status, 400);
  assert.equal((await anon.post("/orders", checkout([{ productId: "1; DROP TABLE orders", quantity: 1 }]))).status, 400);
  assert.equal((await anon.post("/orders", { items: "x" })).status, 400);
});

test("Eş zamanlı siparişler stoğu aşamaz (satır kilidi)", opts, async () => {
  const { data } = await admin.post("/admin/products", {
    name: "Son Ürün", description: "d", price: 10, image: "/assets/a.png", category: "Test", stock: 3
  });
  const id = data.product.id;
  const results = await Promise.all(
    Array.from({ length: 10 }, () => anon.post("/orders", checkout([{ productId: id, quantity: 1 }])))
  );
  assert.equal(results.filter((r) => r.status === 201).length, 3);
  assert.equal(results.filter((r) => r.status === 409).length, 7);
  assert.equal(await stockOf(id), 0);
});

test("Güvenlik: takip kodu olmadan sipariş görülemez ve ödemesi değiştirilemez", opts, async () => {
  const product = await firstProduct();
  const before = product.stock;
  const { data } = await anon.post("/orders", checkout([{ productId: product.id, quantity: 1 }]));
  const { orderId, trackingCode } = data;

  assert.equal((await anon.get(`/orders/${orderId}`)).status, 404, "eski açık uç kaldırıldı");
  assert.equal((await anon.post(`/orders/${orderId}/payment-summary`, {})).status, 404);
  assert.equal((await anon.post(`/orders/${orderId}/test-payment`, { successful: false })).status, 404);
  assert.equal(
    (await anon.post(`/orders/${orderId}/test-payment`, { successful: false, trackingCode: "0".repeat(48) })).status,
    404
  );
  assert.equal(await stockOf(product.id), before - 1, "stok değişmemeli");

  const summary = await anon.post(`/orders/${orderId}/payment-summary`, { trackingCode });
  assert.equal(summary.status, 200);
  assert.deepEqual(Object.keys(summary.data.order).sort(), ["id", "status", "total"], "kişisel veri dönmez");

  const paid = await anon.post(`/orders/${orderId}/test-payment`, { successful: true, trackingCode });
  assert.equal(paid.data.order.status, "Test başarılı");
  assert.equal((await anon.post(`/orders/${orderId}/test-payment`, { successful: false, trackingCode })).status, 409);
});

test("Başarısız ödeme stoğu iade eder", opts, async () => {
  const product = await firstProduct();
  const { data } = await anon.post("/orders", checkout([{ productId: product.id, quantity: 1 }]));
  await anon.post(`/orders/${data.orderId}/test-payment`, { successful: false, trackingCode: data.trackingCode });
  assert.equal(await stockOf(product.id), product.stock);
});

test("Takip: yanlış kod bilgi sızdırmaz, doğru kod durumu döndürür", opts, async () => {
  const product = await firstProduct();
  const { data } = await anon.post("/orders", checkout([{ productId: product.id, quantity: 1 }]));
  const track = (trackingCode) => anon.post("/order-tracking", { orderId: data.orderId, trackingCode });

  assert.equal((await track("0".repeat(48))).status, 404);
  assert.equal((await track({ $ne: null })).status, 400);
  const ok = await track(data.trackingCode);
  assert.equal(ok.status, 200);
  assert.equal(ok.data.order.status, "Ödeme bekleniyor");
  assert.equal(ok.data.order.email, undefined);
  assert.equal(ok.data.order.address, undefined);
});

test("Test ödeme uçları kapatılınca yanıt vermez", opts, async () => {
  const closed = createApp({
    commands: container.commands,
    queries: container.queries,
    config: { ...config, testPaymentsEnabled: false },
    rateLimits: false,
    log: () => {}
  });
  const srv = await new Promise((resolve) => {
    const s = closed.listen(0, () => resolve(s));
  });
  const response = await fetch(`http://127.0.0.1:${srv.address().port}/api/orders/1/test-payment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}"
  });
  assert.equal(response.status, 404);
  await new Promise((resolve) => srv.close(resolve));
});

test("Süresi dolan ödenmemiş sipariş iptal edilir, stok döner", opts, async () => {
  const product = await firstProduct();
  const { data } = await anon.post("/orders", checkout([{ productId: product.id, quantity: 1 }]));
  await pool.query("UPDATE orders SET created_at = NOW() - INTERVAL '2 hours' WHERE id = $1", [data.orderId]);

  const { expired } = await container.commands.execute(new ExpireUnpaidOrdersCommand(60));
  assert.ok(expired >= 1);
  assert.equal(await stockOf(product.id), product.stock);
  const track = await anon.post("/order-tracking", { orderId: data.orderId, trackingCode: data.trackingCode });
  assert.equal(track.data.order.status, "İptal edildi");
});

test("Müşteri: kayıt, giriş, adres, geçmiş, başkasının siparişini iptal edememe", opts, async () => {
  const c = new Client();
  assert.equal((await c.post("/customers/register", CUSTOMER)).status, 201);
  assert.equal((await c.post("/customers/register", CUSTOMER)).status, 409);
  assert.equal((await c.post("/customers/register", { ...CUSTOMER, email: "z@z.co", password: "12345678" })).status, 400);
  assert.equal((await c.post("/customers/login", { email: CUSTOMER.email, password: "yanlis" })).status, 401);
  assert.equal((await c.post("/customers/login", { email: "yok@example.com", password: "yanlis" })).status, 401);
  assert.equal((await c.post("/customers/login", { email: { $gt: "" }, password: "x" })).status, 400);
  assert.equal((await c.post("/customers/login", CUSTOMER)).status, 200);
  assert.equal((await c.get("/customers/session")).data.customer.email, CUSTOMER.email);

  assert.equal((await c.put("/customers/address", { fullName: "A", phone: "05551112233", address: "Adres" })).status, 200);
  assert.equal((await c.get("/customers/address")).data.address.address, "Adres");
  assert.equal((await c.put("/customers/profile", { name: "Yeni Ad" })).data.name, "Yeni Ad");

  const product = await firstProduct();
  const own = await c.post("/orders", checkout([{ productId: product.id, quantity: 1 }]));
  const listed = (await c.get("/customers/orders")).data.orders;
  assert.equal(listed.length, 1);
  assert.equal(listed[0].canCancel, true);

  const other = new Client();
  await other.post("/customers/register", { ...CUSTOMER, email: "diger@example.com" });
  await other.post("/customers/login", { email: "diger@example.com", password: CUSTOMER.password });
  assert.equal((await other.get("/customers/orders")).data.orders.length, 0);
  assert.equal((await other.post(`/customers/orders/${own.data.orderId}/cancel`)).status, 404);

  assert.equal((await c.post(`/customers/orders/${own.data.orderId}/cancel`)).status, 200);
  assert.equal(await stockOf(product.id), product.stock);
});

test("Çıkış belirteci iptal eder: çalınmış çerez işe yaramaz", opts, async () => {
  const c = new Client();
  await c.post("/customers/login", CUSTOMER);
  const stolen = c.cookies.customer_session;
  await c.post("/customers/logout");

  const thief = new Client();
  thief.cookies.customer_session = stolen;
  assert.equal((await thief.get("/customers/orders")).status, 401);

  const a = new Client();
  await a.post("/admin/login", ADMIN);
  const stolenAdmin = a.cookies.admin_session;
  await a.post("/admin/logout");
  const adminThief = new Client();
  adminThief.cookies.admin_session = stolenAdmin;
  assert.equal((await adminThief.get("/admin/stats")).status, 401);
});

test("Parola değişimi: eski parola ister, diğer oturumları kapatır", opts, async () => {
  const email = "degisim@example.com";
  const c = new Client();
  await c.post("/customers/register", { ...CUSTOMER, email });
  await c.post("/customers/login", { email, password: CUSTOMER.password });
  const otherDevice = new Client();
  await otherDevice.post("/customers/login", { email, password: CUSTOMER.password });

  assert.equal((await c.put("/customers/password", { currentPassword: "yanlis", newPassword: "YeniParola99" })).status, 401);
  assert.equal((await c.put("/customers/password", { currentPassword: CUSTOMER.password, newPassword: "kisa" })).status, 400);
  assert.equal((await c.put("/customers/password", { currentPassword: CUSTOMER.password, newPassword: "YeniParola99" })).status, 200);

  assert.equal((await c.get("/customers/address")).status, 200, "bu cihaz oturumda kalır");
  assert.equal((await otherDevice.get("/customers/address")).status, 401, "diğer cihaz düşer");
  assert.equal((await new Client().post("/customers/login", { email, password: CUSTOMER.password })).status, 401);
  assert.equal((await new Client().post("/customers/login", { email, password: "YeniParola99" })).status, 200);
});

test("Parola sıfırlama: tek kullanımlık, aynı yanıt, oturumları kapatır", opts, async () => {
  const email = "sifirla@example.com";
  const c = new Client();
  await c.post("/customers/register", { ...CUSTOMER, email });
  await c.post("/customers/login", { email, password: CUSTOMER.password });

  const unknown = await anon.post("/customers/password/forgot", { email: "kayitsiz@example.com" });
  const known = await anon.post("/customers/password/forgot", { email });
  assert.equal(unknown.status, 200);
  assert.deepEqual(unknown.data, known.data, "yanıt e-postanın kayıtlı olduğunu ele vermez");

  for (let i = 0; i < 100 && !outbox.some((m) => m.to === email); i++) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  const mail = outbox.find((m) => m.to === email);
  assert.ok(mail, "e-posta gönderilmeli");
  assert.ok(!outbox.some((m) => m.to === "kayitsiz@example.com"));
  assert.ok(mail.text.includes("http://site.test/parolaunut.html#token="), "bağlantı PUBLIC_URL'den üretilir");
  const token = mail.text.match(/#token=([a-f0-9]{48})/)[1];

  const { rows } = await pool.query("SELECT token_hash FROM password_reset_tokens");
  assert.ok(rows.every((r) => r.token_hash !== token), "açık belirteç veritabanında tutulmaz");

  assert.equal((await anon.post("/customers/password/reset", { token: "0".repeat(48), password: "Sifirlandi99" })).status, 400);
  assert.equal((await anon.post("/customers/password/reset", { token, password: "kisa" })).status, 400);
  assert.equal((await anon.post("/customers/password/reset", { token, password: "Sifirlandi99" })).status, 200);
  assert.equal((await anon.post("/customers/password/reset", { token, password: "Baska12345" })).status, 400, "tek kullanımlık");

  assert.equal((await c.get("/customers/address")).status, 401, "eski oturum kapanır");
  assert.equal((await new Client().post("/customers/login", { email, password: "Sifirlandi99" })).status, 200);
});

test("Eski biçimli parola girişte yükseltilir", opts, async () => {
  const crypto = require("crypto");
  const salt = "abcdef";
  const legacy = `${salt}:${crypto.scryptSync("EskiParola1", salt, 64).toString("hex")}`;
  await pool.query("INSERT INTO customers (name, email, password_hash) VALUES ('Eski', 'eski@example.com', $1)", [legacy]);

  assert.equal((await new Client().post("/customers/login", { email: "eski@example.com", password: "EskiParola1" })).status, 200);
  const { rows } = await pool.query("SELECT password_hash FROM customers WHERE email = 'eski@example.com'");
  assert.match(rows[0].password_hash, /^scrypt\$/);
  assert.equal((await new Client().post("/customers/login", { email: "eski@example.com", password: "EskiParola1" })).status, 200);
});

test("Yönetici: ürün CRUD, içe aktarma, görsel doğrulaması, satıştan kaldırma", opts, async () => {
  const body = { name: "Yeni", description: "Açıklama", price: "150.50", image: "/assets/a.png", category: "Test", stock: 5 };
  const created = await admin.post("/admin/products", body);
  assert.equal(created.status, 201);
  const id = created.data.product.id;

  assert.equal((await admin.post("/admin/products", { ...body, image: "javascript:alert(1)" })).status, 400);
  assert.equal((await admin.put(`/admin/products/${id}`, { ...body, stock: 7 })).data.product.stock, 7);
  assert.equal((await admin.put("/admin/products/999999", body)).status, 404);
  assert.equal((await admin.put("/admin/products/abc", body)).status, 400);

  const deleted = await admin.delete(`/admin/products/${id}`);
  assert.equal(deleted.data.archived, false);
  assert.equal((await admin.delete(`/admin/products/${id}`)).status, 404);

  // Satılmış ürün silinmez, satıştan kaldırılır ve geri alınır.
  const sold = await admin.post("/admin/products", body);
  const soldId = sold.data.product.id;
  await anon.post("/orders", checkout([{ productId: soldId, quantity: 1 }]));
  assert.equal((await admin.delete(`/admin/products/${soldId}`)).data.archived, true);
  assert.equal((await anon.get(`/products?ids=${soldId}`)).data.products.length, 0);
  assert.equal((await anon.post("/orders", checkout([{ productId: soldId, quantity: 1 }]))).status, 400);
  assert.equal((await admin.post(`/admin/products/${soldId}/restore`)).status, 200);
  assert.equal((await anon.get(`/products?ids=${soldId}`)).data.products.length, 1);

  const imported = await admin.post("/admin/products/bulk", { products: [{ name: "CSV 1", price: 10 }, { name: "CSV 2", price: 20, stock: 2 }] });
  assert.equal(imported.data.count, 2);
  const badImport = await admin.post("/admin/products/bulk", { products: [{ name: "Tamam", price: 1 }, { name: "", price: 1 }] });
  assert.equal(badImport.status, 400);
  assert.match(badImport.data.message, /3\. satır/);
  const names = (await admin.get("/admin/products")).data.products.map((p) => p.name);
  assert.ok(!names.includes("Tamam"), "içe aktarma hep ya da hiç çalışır");

  assert.ok((await admin.get("/admin/stats")).data.stats.product_count > 0);
});

test("Yönetici: sipariş filtreleri, sayfalama, yaşam döngüsü, kargo", opts, async () => {
  const product = await firstProduct();
  const { data } = await anon.post("/orders", checkout([{ productId: product.id, quantity: 1 }], { fullName: "Filtre Kişisi" }));
  const id = data.orderId;

  const found = await admin.get(`/admin/orders?q=${encodeURIComponent("Filtre Kişisi")}`);
  assert.equal(found.data.total, 1);
  assert.deepEqual(found.data.orders[0].allowed_statuses, ["Test başarılı", "Test başarısız", "Hazırlanıyor", "İptal edildi"]);

  const paged = await admin.get("/admin/orders?page=1&pageSize=2");
  assert.equal(paged.data.orders.length, 2);
  assert.ok(paged.data.pages > 1);
  assert.equal((await admin.get("/admin/orders?status=Ödeme bekleniyor&from=2000-01-01&to=2999-01-01")).status, 200);
  assert.equal((await admin.get(`/admin/orders?from=${encodeURIComponent("'; DROP TABLE orders;--")}`)).status, 200);

  const status = (s) => admin.patch(`/admin/orders/${id}/status`, { status: s });
  assert.equal((await status("Teslim edildi")).status, 409, "basamak atlanamaz");
  assert.equal((await status("Uydurma")).status, 400);
  assert.equal((await status("Hazırlanıyor")).status, 200);
  assert.equal((await status("Kargoya verildi")).status, 200);

  assert.equal((await admin.patch(`/admin/orders/${id}/shipping`, { tracking_url: "javascript:alert(1)" })).status, 400);
  const shipping = await admin.patch(`/admin/orders/${id}/shipping`, {
    shipping_company: "Kargo A.Ş.", tracking_number: "123", tracking_url: "https://kargo.example/123"
  });
  assert.equal(shipping.data.order.tracking_number, "123");

  const track = await anon.post("/order-tracking", { orderId: id, trackingCode: data.trackingCode });
  assert.equal(track.data.order.shipping_company, "Kargo A.Ş.");
});

test("Destek: e-posta yalnızca yanıt değişince gönderilir", opts, async () => {
  assert.equal((await anon.post("/support", { fullName: "A", email: "gecersiz", message: "m" })).status, 400);
  const created = await anon.post("/support", { fullName: "Destek Kişisi", email: "destek@example.com", message: "<img src=x onerror=alert(1)>" });
  assert.equal(created.status, 201);
  const id = created.data.request.id;
  const sent = () => outbox.filter((m) => m.to === "destek@example.com").length;

  await admin.put(`/admin/support/${id}`, { status: "İnceleniyor", admin_response: "" });
  assert.equal(sent(), 0, "durum değişikliği e-posta atmaz");

  const reply = await admin.put(`/admin/support/${id}`, { status: "Yanıtlandı", admin_response: "Merhaba" });
  assert.equal(reply.data.emailSent, true);
  assert.equal(sent(), 1);

  await admin.put(`/admin/support/${id}`, { status: "Kapatıldı", admin_response: "Merhaba" });
  assert.equal(sent(), 1, "aynı yanıt tekrar gönderilmez");

  assert.equal((await admin.get(`/admin/support/${id}`)).data.request.status, "Kapatıldı");
  assert.equal((await admin.put(`/admin/support/${id}`, { status: "Uydurma" })).status, 400);
  assert.equal((await admin.delete(`/admin/support/${id}`)).status, 200);
  assert.equal((await admin.get(`/admin/support/${id}`)).status, 404);
});

test("Hatalı istekler 500 üretmez ve iç ayrıntı sızdırmaz", opts, async () => {
  const raw = await fetch(`${base}/api/customers/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{bozuk"
  });
  assert.equal(raw.status, 400);

  const large = await anon.post("/support", { fullName: "A", email: "a@b.co", message: "x".repeat(40000) });
  assert.equal(large.status, 413);

  assert.equal((await fetch(`${base}/api/orders/%E0%A4%A/test-payment`, { method: "POST" })).status, 400);
  assert.equal((await anon.get("/yok")).status, 404);

  const weird = await anon.post("/orders", []);
  assert.equal(weird.status, 400);
});

test("Rate limit: hatalı girişler engellenir", opts, async () => {
  const limited = createApp({ commands: container.commands, queries: container.queries, config, log: () => {} });
  const srv = await new Promise((resolve) => {
    const s = limited.listen(0, () => resolve(s));
  });
  const url = `http://127.0.0.1:${srv.address().port}/api/admin/login`;
  const attempt = () =>
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "x", password: "y" })
    }).then((r) => r.status);

  const statuses = [];
  for (let i = 0; i < 7; i++) statuses.push(await attempt());
  assert.deepEqual(statuses, [401, 401, 401, 401, 401, 429, 429]);
  await new Promise((resolve) => srv.close(resolve));
});
