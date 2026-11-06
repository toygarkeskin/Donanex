"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");

const { RsaTokenIssuer } = require("../../src/infrastructure/security/RsaTokenIssuer");
const { ScryptPasswordHasher } = require("../../src/infrastructure/security/ScryptPasswordHasher");
const { OpaqueTokenService } = require("../../src/infrastructure/security/OpaqueTokenService");
const { Pkce } = require("../../src/infrastructure/security/Pkce");
const { safeEqual } = require("../../src/infrastructure/security/safeEqual");
const { InMemoryCache } = require("../../src/infrastructure/cache/RedisCache");

const keyPair = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" }
});

const issuerFor = (now) =>
  new RsaTokenIssuer({
    privateKeyPem: keyPair.privateKey,
    publicKeyPem: keyPair.publicKey,
    issuer: "https://donanex.test",
    clock: { now: () => new Date(now()) }
  });

const accessToken = (tokens, overrides = {}) =>
  tokens.issueAccessToken({
    subject: "user-1",
    audience: "donanex-web",
    scope: "openid shop",
    sessionId: "session-1",
    roles: [],
    sessionVersion: 1,
    expiresAt: new Date(Date.now() + 60_000),
    ...overrides
  });

/* ------------------------------------------------------------ jetonlar */

test("Jeton üretilir ve doğrulanır", async () => {
  const tokens = issuerFor(() => Date.now());
  const token = await accessToken(tokens);
  const payload = await tokens.verifyAccessToken(token);

  assert.equal(payload.sub, "user-1");
  assert.equal(payload.iss, "https://donanex.test");
  assert.equal(payload.sid, "session-1");
  assert.ok(payload.jti, "her jetonun tekil kimliği olmalı");
});

test("Kurcalanmış, yanlış imzalı ve 'alg: none' jetonlar reddedilir", async () => {
  const tokens = issuerFor(() => Date.now());
  const token = await accessToken(tokens);
  const [header, body, signature] = token.split(".");

  const forgedBody = Buffer.from(
    JSON.stringify({ sub: "hacker", iss: "https://donanex.test", exp: 9e9, iat: 1, jti: "x" })
  ).toString("base64url");
  assert.equal(await tokens.verifyAccessToken(`${header}.${forgedBody}.${signature}`), null, "gövde değişimi");

  const noneHeader = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  assert.equal(await tokens.verifyAccessToken(`${noneHeader}.${body}.`), null, "alg: none");

  assert.equal(await tokens.verifyAccessToken(`${header}.${body}.${"A".repeat(signature.length)}`), null);
  assert.equal(await tokens.verifyAccessToken("cop"), null);
  assert.equal(await tokens.verifyAccessToken(undefined), null);
  assert.equal(await tokens.verifyAccessToken("a.b.c.d"), null);
});

test("Başka anahtarla imzalanmış jeton kabul edilmez", async () => {
  const tokens = issuerFor(() => Date.now());
  const other = new RsaTokenIssuer({
    ...crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" }
    }),
    privateKeyPem: crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" }
    }).privateKey,
    publicKeyPem: keyPair.publicKey,
    issuer: "https://donanex.test"
  });

  const foreign = await accessToken(other);
  assert.equal(await tokens.verifyAccessToken(foreign), null);
});

test("Süresi dolan ve yanlış alıcıya ait jeton reddedilir", async () => {
  let now = 1_000_000;
  const tokens = issuerFor(() => now);
  const token = await accessToken(tokens, { expiresAt: new Date(now + 1000) });

  assert.ok(await tokens.verifyAccessToken(token));
  assert.equal(await tokens.verifyAccessToken(token, { audience: "baska-istemci" }), null);

  now += 2000;
  assert.equal(await tokens.verifyAccessToken(token), null, "süresi dolmuş");
});

test("Farklı issuer'dan gelen jeton reddedilir", async () => {
  const tokens = issuerFor(() => Date.now());
  const foreign = new RsaTokenIssuer({
    privateKeyPem: keyPair.privateKey,
    publicKeyPem: keyPair.publicKey,
    issuer: "https://baska.test"
  });
  assert.equal(await tokens.verifyAccessToken(await accessToken(foreign)), null);
});

test("JWKS açık anahtarı yayınlar, gizli anahtarı ASLA sızdırmaz", () => {
  const tokens = issuerFor(() => Date.now());
  const jwks = tokens.jwks();
  const serialized = JSON.stringify(jwks);

  assert.equal(jwks.keys.length, 1);
  assert.equal(jwks.keys[0].kty, "RSA");
  assert.equal(jwks.keys[0].alg, "RS256");
  assert.ok(jwks.keys[0].kid);
  assert.ok(!("d" in jwks.keys[0]), "özel üs dışarı verilemez");
  assert.ok(!serialized.includes("PRIVATE"));
});

test("Zayıf anahtarla jeton servisi kurulamaz", () => {
  const weak = crypto.generateKeyPairSync("rsa", {
    modulusLength: 1024,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" }
  });
  assert.throws(
    () => new RsaTokenIssuer({ privateKeyPem: weak.privateKey, publicKeyPem: weak.publicKey, issuer: "x" }),
    /2048/
  );
});

/* ------------------------------------------------------------ parola */

test("Parola özeti doğrular ve yanlış parolayı reddeder", async () => {
  const hasher = new ScryptPasswordHasher();
  const hash = await hasher.hash("GucluParola1");

  assert.match(hash, /^scrypt\$65536\$8\$2\$/);
  assert.ok(!hash.includes("GucluParola1"), "parola düz metin saklanmaz");
  assert.equal(await hasher.verify("GucluParola1", hash), true);
  assert.equal(await hasher.verify("GucluParola2", hash), false);
  assert.equal(hasher.needsRehash(hash), false);
});

test("Aynı parola her seferinde farklı özet üretir (tuz)", async () => {
  const hasher = new ScryptPasswordHasher();
  const [first, second] = await Promise.all([hasher.hash("AyniParola1"), hasher.hash("AyniParola1")]);
  assert.notEqual(first, second);
});

test("Bozuk özet ve sahte kullanıcı güvenle ele alınır", async () => {
  const hasher = new ScryptPasswordHasher();

  for (const bozuk of ["", "cop", "scrypt$x$y$z$a$b", null, undefined, "tuz:anahtar"]) {
    assert.equal(await hasher.verify("x", bozuk), false, String(bozuk));
    assert.equal(hasher.needsRehash(bozuk), true);
  }
  assert.equal(await hasher.verifyDummy("herhangi"), false);
});

/* ------------------------------------------- opak jetonlar ve PKCE */

test("Opak jeton tahmin edilemez ve veritabanında açık durmaz", () => {
  const tokens = new OpaqueTokenService("p".repeat(40));
  const code = tokens.generate();

  assert.equal(tokens.isWellFormed(code), true);
  assert.notEqual(tokens.hash(code), code, "özet jetonun kendisi olamaz");
  assert.equal(tokens.hash(code), tokens.hash(code), "aynı jeton aynı özeti verir");
  assert.notEqual(tokens.generate(), code);

  for (const kotu of ["' OR 1=1 --", { $ne: null }, "", "ABC", "a".repeat(63), undefined]) {
    assert.equal(tokens.isWellFormed(kotu), false, String(kotu));
  }
});

test("Farklı pepper farklı özet üretir", () => {
  const code = "a".repeat(64);
  const first = new OpaqueTokenService("1".repeat(40)).hash(code);
  const second = new OpaqueTokenService("2".repeat(40)).hash(code);
  assert.notEqual(first, second, "pepper olmadan özet yeniden üretilemez");
});

test("Kısa pepper ile servis kurulamaz", () => {
  assert.throws(() => new OpaqueTokenService("kisa"), /32/);
  assert.throws(() => new OpaqueTokenService(""), /32/);
});

test("PKCE doğru doğrulayıcıyı kabul, yanlışı reddeder", () => {
  const pkce = new Pkce();
  const verifier = crypto.randomBytes(48).toString("base64url");
  const challenge = pkce.challengeFor(verifier);

  assert.equal(pkce.verify(verifier, challenge), true);
  assert.equal(pkce.verify(crypto.randomBytes(48).toString("base64url"), challenge), false);
  assert.equal(pkce.verify(verifier, "yanlis"), false);
  assert.equal(pkce.verify(undefined, challenge), false);
  assert.equal(pkce.verify(verifier, undefined), false);
});

test("safeEqual farklı uzunlukta bile çalışır", () => {
  assert.equal(safeEqual("ayni", "ayni"), true);
  assert.equal(safeEqual("ayni", "baska"), false);
  assert.equal(safeEqual("", ""), true);
  assert.equal(safeEqual("a", "aa"), false);
});

/* ------------------------------------------------------------ önbellek */

test("Bellek içi önbellek süre ve ön ek silmeyi uygular", async () => {
  const cache = new InMemoryCache();

  await cache.set("catalog:a", { x: 1 }, 60);
  await cache.set("catalog:b", { x: 2 }, 60);
  await cache.set("policy:1", { x: 3 }, 60);

  assert.deepEqual(await cache.get("catalog:a"), { x: 1 });
  await cache.deleteByPrefix("catalog:");
  assert.equal(await cache.get("catalog:a"), null);
  assert.equal(await cache.get("catalog:b"), null);
  assert.deepEqual(await cache.get("policy:1"), { x: 3 }, "başka ön ek etkilenmez");

  await cache.set("kisa", 1, -1);
  assert.equal(await cache.get("kisa"), null, "süresi dolmuş anahtar dönmez");
  assert.equal(await cache.get("hic-yok"), null);
});
