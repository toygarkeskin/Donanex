"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");

const { HmacTokenService } = require("../../../src/infrastructure/security/HmacTokenService");
const { ScryptPasswordHasher } = require("../../../src/infrastructure/security/ScryptPasswordHasher");
const { OpaqueTokenService } = require("../../../src/infrastructure/security/OpaqueTokenService");
const { safeEqual } = require("../../../src/infrastructure/security/safeEqual");

const SECRET = "s".repeat(40);

test("Token: sahte imza, yanlış tür ve süresi dolan belirteç reddedilir", () => {
  let now = 1000;
  const tokens = new HmacTokenService(SECRET, () => now);
  const token = tokens.issue({ typ: "customer", customerId: "1" }, 500);

  assert.equal(tokens.verify(token, "customer").customerId, "1");
  assert.equal(tokens.verify(token, "admin"), null, "müşteri belirteci yönetici sayılamaz");

  const [body, signature] = token.split(".");
  const forged = Buffer.from(JSON.stringify({ typ: "admin", jti: "x", expiresAt: 9e15 })).toString("base64url");
  assert.equal(tokens.verify(`${forged}.${signature}`), null);
  assert.equal(tokens.verify(`${body}.${"A".repeat(signature.length)}`), null);
  assert.equal(tokens.verify("cop"), null);
  assert.equal(tokens.verify(undefined), null);

  now = 2000;
  assert.equal(tokens.verify(token, "customer"), null);
});

test("Token: kısa gizli anahtarla servis oluşturulamaz", () => {
  assert.throws(() => new HmacTokenService("kisa"), /32/);
});

test("Parola: doğrular, eski biçimi tanır ve yükseltme ister", async () => {
  const hasher = new ScryptPasswordHasher();
  const hash = await hasher.hash("Parola123");

  assert.match(hash, /^scrypt\$65536\$8\$2\$/);
  assert.equal(await hasher.verify("Parola123", hash), true);
  assert.equal(await hasher.verify("yanlis", hash), false);
  assert.equal(hasher.needsRehash(hash), false);
  assert.equal(await hasher.verifyDummy("Parola123"), false);
  assert.equal(await hasher.verify("x", "bozuk-kayit"), false);

  const salt = "abcd";
  const legacyKey = crypto.scryptSync("Eski12345", salt, 64).toString("hex");
  const legacy = `${salt}:${legacyKey}`;
  assert.equal(await hasher.verify("Eski12345", legacy), true);
  assert.equal(hasher.needsRehash(legacy), true);
});

test("Opak kod: biçim denetimi ve özet", () => {
  const codes = new OpaqueTokenService();
  const code = codes.generate();
  assert.equal(codes.isWellFormed(code), true);
  assert.equal(codes.isWellFormed("' OR 1=1 --"), false);
  assert.equal(codes.isWellFormed({ $ne: null }), false);
  assert.notEqual(codes.hash(code), code);
  assert.notEqual(codes.generate(), code);
});

test("safeEqual", () => {
  assert.equal(safeEqual("a", "a"), true);
  assert.equal(safeEqual("a", "b"), false);
});
