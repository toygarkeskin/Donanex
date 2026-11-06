"use strict";

/**
 * Entegrasyon testi iskeleti: gerçek PostgreSQL ve Redis ile, gerçek HTTP
 * üzerinden. Yalnızca e-posta sahtedir — hiçbir ileti dışarı çıkmaz.
 *
 * TEST_DB_HOST verilmezse testler atlanır, böylece altyapısı olmayan bir
 * makinede birim testleri yine de çalışır.
 */
import crypto from "crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createPool, waitForDatabase } from "../../src/infrastructure/persistence/postgres/pool";
import { runMigrations } from "../../src/infrastructure/persistence/postgres/migrate";
import { RedisCache, InMemoryCache } from "../../src/infrastructure/cache/RedisCache";
import { buildContainer } from "../../src/bootstrap/container";
import { syncRolesAndPermissions, ensureSystemAdmin } from "../../src/bootstrap/syncAccessControl";
import { syncOAuthClients } from "../../src/bootstrap/syncOAuthClients";
import { seedDemoData, DEMO_PASSWORD } from "../../src/bootstrap/demoSeed";
import { createApp } from "../../src/presentation/http/app";
import { OutboxRelay } from "../../src/infrastructure/messaging/OutboxRelay";
import { renderEmail } from "../../src/infrastructure/mail/templates";

import type { Server } from "node:net";
import type { AppConfig } from "../../src/config/env";
import type { Cache, Logger, Row } from "../../src/application/shared/contracts";

/**
 * API yanitinin test tarafindaki gorunumu.
 *
 * data bilincli olarak esnek (Row): testin DOGRULADIGI sey zaten o govdenin
 * sekli. Burada siki bir tip yazmak, assert satirlarini gereksiz kilar ve
 * API degistiginde testin degil tipin kirilmasina yol acardi.
 */
export interface ApiResponse {
  readonly status: number;
  readonly data: Row;
  readonly headers: Headers;
}

/** Toplanan sahte e-posta. */
interface SentMail extends Row {
  readonly to: string;
  readonly subject: string;
}

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

const silentLogger: Logger & { child(): Logger } = {
  debug() {},
  info() {},
  warn() {},
  // Beklenmeyen hatalar sessizce yutulmaz: test ciktisinda gorunur.
  error(template: string, properties?: Record<string, unknown>) {
    console.error("[test-api-error]", template, JSON.stringify(properties));
  },
  child() {
    return this;
  }
};

/**
 * Dinleyen sunucunun portu.
 *
 * address() string ya da null da dondurebilir (unix soketi, kapali sunucu);
 * test icin daraltmak yerine duruyoruz, cunku port yoksa hicbir istek
 * gonderilemez ve sessizce bos adrese baglanmak kafa karistirir.
 */
function portOf(server: Server): number {
  const adres = server.address();
  if (adres === null || typeof adres === "string") {
    throw new Error("Test sunucusu TCP portuna baglanamadi.");
  }
  return adres.port;
}

/** Gönderilen e-postaları toplayan sahte posta kutusu. */
function createOutbox() {
  const messages: SentMail[] = [];
  return {
    messages,
    mailer: {
      async send(message: Row) {
        messages.push(message as SentMail);
        return true;
      }
    },
    /** Olaylar kuyruktan geçtiği için e-posta gecikmeli gelir. */
    async waitFor(predicate: (mail: SentMail) => boolean, timeoutMs = 5000): Promise<SentMail | null> {
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
  const config: AppConfig = Object.freeze({
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
      host: process.env.TEST_DB_HOST!,
      port: Number(process.env.TEST_DB_PORT || 5432),
      database: process.env.TEST_DB_NAME!,
      user: process.env.TEST_DB_USER!,
      password: process.env.TEST_DB_PASSWORD!,
      poolSize: 10
    },
    redisUrl: process.env.TEST_REDIS_URL || "",
    rabbitUrl: "",
    jwt: { privateKey: keys.privateKey, publicKey: keys.publicKey },
    tokenPepper: "t".repeat(48),
    // "as const": aksi halde string e genisler ve LogLevel i karsilamaz.
    logging: { url: "", apiKey: "", level: "error" as const },
    smtp: {},
    bootstrapAdmin: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
  });

  const pool = createPool(config.db);
  await waitForDatabase(pool, { log: () => {} });

  // Her koşu temiz bir şemayla başlar.
  await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  await runMigrations(pool, () => {});

  // Sozlesme tipi kullaniliyor: Redis varsa onunla, yoksa bellek ici surumle
  // ayni testler kosuyor.
  let cache: Cache & { close(): Promise<void> } = new InMemoryCache();
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
    async publish(type: string, message: Row) {
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
  const server = await new Promise<Server>((resolve) => {
    const listener = app.listen(0, () => resolve(listener));
  });

  /** Hız sınırları açık ayrı bir sunucu; yalnızca sınır testi kullanır. */
  const limited = createApp({ commands, queries, services, config, rateLimits: true });
  const limitedServer = await new Promise<Server>((resolve) => {
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
    base: `http://127.0.0.1:${portOf(server)}`,
    limitedBase: `http://127.0.0.1:${portOf(limitedServer)}`,
    relay,
    async stop() {
      relay.stop();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await new Promise<void>((resolve) => limitedServer.close(() => resolve()));
      await pool.end();
      await cache.close();
    }
  };
}

/**
 * signIn sonucu.
 *
 * Basarisizlikta FIRLATMAZ: testlerin bir kismi kasten yanlis parolayla
 * giris deneyip reddedildigini dogruluyor. Ayrim ok alanindadir.
 */
type SignInOutcome =
  // reason?: undefined — basari dalinda da alan OKUNABILIR olsun diye.
  // assert.ok(result.ok, result.reason) kalibi boylece daralmaya gerek duymaz.
  | { ok: true; tokens: Row; verifier: string; state: string | null; reason?: undefined }
  | { ok: false; reason?: string; status?: number };

/**
 * Çerezleri ve erişim jetonunu taşıyan basit istemci.
 * signIn gerçek OAuth akışını baştan sona yürütür.
 */
class Client {
  readonly base: string;
  /**
   * Sunucunun Set-Cookie ile verdigi cerezler; gercek tarayici gibi tasinir.
   * Testler HttpOnly cerezlerin gerceken verildigini buradan dogruluyor.
   */
  readonly cookies: Record<string, string> = {};
  accessToken: string | null = null;

  constructor(base: string) {
    this.base = base;
  }

  async request(
    method: string,
    path: string,
    body?: unknown,
    extraHeaders: Record<string, string> = {}
  ): Promise<ApiResponse> {
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
      body: body === undefined ? undefined : isForm ? (body as string) : JSON.stringify(body)
    });

    for (const raw of response.headers.getSetCookie()) {
      const [pair] = raw.split(";");
      const index = pair.indexOf("=");
      const value = pair.slice(index + 1);
      if (value) this.cookies[pair.slice(0, index)] = value;
      else delete this.cookies[pair.slice(0, index)];
    }

    const text = await response.text();
    let data: Row = {};
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text.slice(0, 200) };
    }
    return { status: response.status, data, headers: response.headers };
  }

  /* Ham ikili gövde — görsel yükleme ucu multipart değil, dosyanın kendisini bekler. */
  async upload(path: string, buffer: Buffer, contentType: string): Promise<ApiResponse> {
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
    let data: Row = {};
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text.slice(0, 200) };
    }
    return { status: response.status, data, headers: response.headers };
  }

  get(path: string, headers?: Record<string, string>) {
    return this.request("GET", path, undefined, headers);
  }
  post(path: string, body: unknown = {}, headers?: Record<string, string>) {
    return this.request("POST", path, body, headers);
  }
  put(path: string, body: unknown = {}) {
    return this.request("PUT", path, body);
  }
  patch(path: string, body: unknown = {}) {
    return this.request("PATCH", path, body);
  }
  delete(path: string) {
    return this.request("DELETE", path);
  }

  form(path: string, params: Record<string, string>, headers: Record<string, string> = {}) {
    return this.request("POST", path, new URLSearchParams(params).toString(), {
      "Content-Type": "application/x-www-form-urlencoded",
      ...headers
    });
  }

  /** Tam yetkilendirme kodu akışı: authorize → giriş → kod → jeton. */
  async signIn(email: string, password: string): Promise<SignInOutcome> {
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
    const code = url.searchParams.get("code");
    // Kod yoksa bos bir jeton istegi gondermek yerine nedenini soyluyoruz.
    if (!code) return { ok: false, reason: `yonlendirmede kod yok: ${redirectTo}` };

    const token = await this.form("/oauth/token", {
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      client_id: "donanex-web",
      code_verifier: verifier
    });
    if (token.status !== 200) return { ok: false, reason: JSON.stringify(token.data) };

    this.accessToken = token.data.access_token;
    return { ok: true, tokens: token.data, verifier, state: url.searchParams.get("state") };
  }
}

export { enabled, skip, startHarness, Client, ADMIN_EMAIL, ADMIN_PASSWORD, DEMO_PASSWORD, REDIRECT_URI };
