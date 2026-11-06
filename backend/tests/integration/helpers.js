"use strict";

/**
 * Entegrasyon testi iskeleti: gerçek PostgreSQL ve Redis ile, gerçek HTTP
 * üzerinden. Yalnızca e-posta sahtedir — hiçbir ileti dışarı çıkmaz.
 *
 * TEST_DB_HOST verilmezse testler atlanır, böylece altyapısı olmayan bir
 * makinede birim testleri yine de çalışır.
 */
const crypto = require("crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { createPool, waitForDatabase } = require("../../src/infrastructure/persistence/postgres/pool");
const { runMigrations } = require("../../src/infrastructure/persistence/postgres/migrate");
const { RedisCache, InMemoryCache } = require("../../src/infrastructure/cache/RedisCache");
const { buildContainer } = require("../../src/bootstrap/container");
const { syncRolesAndPermissions, ensureSystemAdmin } = require("../../src/bootstrap/syncAccessControl");
const { syncOAuthClients } = require("../../src/bootstrap/syncOAuthClients");
const { seedDemoData, DEMO_PASSWORD } = require("../../src/bootstrap/demoSeed");
const { createApp } = require("../../src/presentation/http/app");
const { OutboxRelay } = require("../../src/infrastructure/messaging/OutboxRelay");
const { renderEmail } = require("../../src/infrastructure/mail/templates");

const enabled = Boolean(process.env.TEST_DB_HOST);
const skip = enabled ? false : "TEST_DB_HOST tanımlı değil";

const ADMIN_EMAIL = "admin@donanex.test";
const ADMIN_PASSWORD = "Yonetici-Test-2026";
const REDIRECT_URI = "http://localhost:8090/auth/callback";

const keys = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" }
});

const silentLogger = {
  debug() {},
  info() {},
  warn() {},
  // Beklenmeyen hatalar sessizce yutulmaz: test ciktisinda gorunur.
  error(template, properties) {
    console.error("[test-api-error]", template, JSON.stringify(properties));
  },
  child() {
    return this;
  }
};

/** Gönderilen e-postaları toplayan sahte posta kutusu. */
function createOutbox() {
  const messages = [];
  return {
    messages,
    mailer: {
      async send(message) {
        messages.push(message);
        return true;
      }
    },
    /** Olaylar kuyruktan geçtiği için e-posta gecikmeli gelir. */
    async waitFor(predicate, timeoutMs = 5000) {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        const found = messages.find(predicate);
        if (found) return found;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      return null;
    }
  };
}

async function startHarness() {
  const config = Object.freeze({
    role: "api",
    port: 0,
    isProduction: false,
    isTest: true,
    publicUrl: "http://localhost:8090",
    issuer: "http://localhost:8090",
    trustProxy: false,
    cookieSecure: false,
    paymentsMode: "simulated",
    seedDemoData: true,
    // Her koşu kendi geçici klasörüne yazar; testler birbirinin dosyasını görmez.
    uploadDir: fs.mkdtempSync(path.join(os.tmpdir(), "donanex-yukleme-")),
    db: {
      host: process.env.TEST_DB_HOST,
      port: Number(process.env.TEST_DB_PORT || 5432),
      database: process.env.TEST_DB_NAME,
      user: process.env.TEST_DB_USER,
      password: process.env.TEST_DB_PASSWORD,
      poolSize: 10
    },
    redisUrl: process.env.TEST_REDIS_URL || "",
    rabbitUrl: "",
    jwt: { privateKey: keys.privateKey, publicKey: keys.publicKey },
    tokenPepper: "t".repeat(48),
    logging: { url: "", apiKey: "", level: "error" },
    smtp: {},
    bootstrapAdmin: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
  });

  const pool = createPool(config.db);
  await waitForDatabase(pool, { log: () => {} });

  // Her koşu temiz bir şemayla başlar.
  await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  await runMigrations(pool, () => {});

  let cache = new InMemoryCache();
  if (config.redisUrl) {
    const redis = new RedisCache(config.redisUrl, silentLogger);
    await redis.connect();
    await redis.client.flushAll();
    cache = redis;
  }

  const outbox = createOutbox();
  const { commands, queries, services } = buildContainer(
    { pool, cache, logger: silentLogger, config },
    { mailer: outbox.mailer }
  );

  await syncRolesAndPermissions(services.unitOfWork, silentLogger);
  await syncOAuthClients({ ...services, config, logger: silentLogger });
  await ensureSystemAdmin({ ...services, config, logger: silentLogger });
  await seedDemoData({ ...services, config, logger: silentLogger });

  /**
   * Testte RabbitMQ yoktur. Gerçek OutboxRelay, yayınladığı olayı doğrudan
   * e-posta tüketicisine veren bir broker ile çalıştırılır: outbox -> olay ->
   * e-posta zinciri uçtan uca sınanır, yalnızca AMQP atlaması atlanır.
   */
  const directBroker = {
    async publish(type, message) {
      const email = renderEmail(type, message.payload, { publicUrl: config.publicUrl });
      if (email && message.payload.email) {
        await outbox.mailer.send({ to: message.payload.email, ...email });
      }
    }
  };
  const relay = new OutboxRelay({
    unitOfWork: services.unitOfWork,
    broker: directBroker,
    logger: silentLogger,
    intervalMs: 50
  });
  relay.start();

  const app = createApp({ commands, queries, services, config, rateLimits: false });
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, () => resolve(listener));
  });

  /** Hız sınırları açık ayrı bir sunucu; yalnızca sınır testi kullanır. */
  const limited = createApp({ commands, queries, services, config, rateLimits: true });
  const limitedServer = await new Promise((resolve) => {
    const listener = limited.listen(0, () => resolve(listener));
  });

  return {
    pool,
    cache,
    outbox,
    commands,
    queries,
    services,
    config,
    base: `http://127.0.0.1:${server.address().port}`,
    limitedBase: `http://127.0.0.1:${limitedServer.address().port}`,
    relay,
    async stop() {
      relay.stop();
      await new Promise((resolve) => server.close(resolve));
      await new Promise((resolve) => limitedServer.close(resolve));
      await pool.end();
      await cache.close?.();
    }
  };
}

/**
 * Çerezleri ve erişim jetonunu taşıyan basit istemci.
 * signIn gerçek OAuth akışını baştan sona yürütür.
 */
class Client {
  constructor(base) {
    this.base = base;
    this.cookies = {};
    this.accessToken = null;
  }

  async request(method, path, body, extraHeaders = {}) {
    const cookie = Object.entries(this.cookies)
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
    const isForm = extraHeaders["Content-Type"] === "application/x-www-form-urlencoded";

    const response = await fetch(`${this.base}${path}`, {
      method,
      redirect: "manual",
      headers: {
        ...(body !== undefined && !isForm ? { "Content-Type": "application/json" } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
        ...(this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {}),
        ...extraHeaders
      },
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body)
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
      data = { raw: text.slice(0, 200) };
    }
    return { status: response.status, data, headers: response.headers };
  }

  /* Ham ikili gövde — görsel yükleme ucu multipart değil, dosyanın kendisini bekler. */
  async upload(path, buffer, contentType) {
    const cookie = Object.entries(this.cookies)
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");

    const response = await fetch(`${this.base}${path}`, {
      method: "POST",
      redirect: "manual",
      headers: {
        "Content-Type": contentType,
        ...(cookie ? { Cookie: cookie } : {}),
        ...(this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {})
      },
      body: buffer
    });

    const text = await response.text();
    let data = {};
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text.slice(0, 200) };
    }
    return { status: response.status, data, headers: response.headers };
  }

  get(path, headers) {
    return this.request("GET", path, undefined, headers);
  }
  post(path, body = {}, headers) {
    return this.request("POST", path, body, headers);
  }
  put(path, body = {}) {
    return this.request("PUT", path, body);
  }
  patch(path, body = {}) {
    return this.request("PATCH", path, body);
  }
  delete(path) {
    return this.request("DELETE", path);
  }

  form(path, params, headers = {}) {
    return this.request("POST", path, new URLSearchParams(params).toString(), {
      "Content-Type": "application/x-www-form-urlencoded",
      ...headers
    });
  }

  /** Tam yetkilendirme kodu akışı: authorize → giriş → kod → jeton. */
  async signIn(email, password) {
    const verifier = crypto.randomBytes(48).toString("base64url");
    const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");

    const authorize = await this.get(
      `/oauth/authorize?response_type=code&client_id=donanex-web` +
        `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
        `&scope=${encodeURIComponent("openid profile email shop store:manage admin")}` +
        `&state=test-state&code_challenge=${challenge}&code_challenge_method=S256`
    );

    const location = authorize.headers.get("location");
    if (!location) return { ok: false, reason: `authorize yönlendirmedi (${authorize.status})` };

    let redirectTo = location;
    if (location.includes("/giris?auth=")) {
      const authRequestId = new URL(location).searchParams.get("auth");
      const signIn = await this.post("/api/auth/sign-in", { email, password, authRequestId });
      if (signIn.status !== 200) return { ok: false, reason: signIn.data.message, status: signIn.status };
      redirectTo = signIn.data.redirectTo;
    }

    const url = new URL(redirectTo);
    const token = await this.form("/oauth/token", {
      grant_type: "authorization_code",
      code: url.searchParams.get("code"),
      redirect_uri: REDIRECT_URI,
      client_id: "donanex-web",
      code_verifier: verifier
    });
    if (token.status !== 200) return { ok: false, reason: JSON.stringify(token.data) };

    this.accessToken = token.data.access_token;
    return { ok: true, tokens: token.data, verifier, state: url.searchParams.get("state") };
  }
}

module.exports = { enabled, skip, startHarness, Client, ADMIN_EMAIL, ADMIN_PASSWORD, DEMO_PASSWORD, REDIRECT_URI };
