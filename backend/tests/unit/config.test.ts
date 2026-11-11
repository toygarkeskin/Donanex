"use strict";

import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";

import { loadConfig, validateConfig } from "../../src/config/env";

const keys = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" }
});

/** Geçerli bir ortam; testler bunun üzerine tek bir değeri bozar. */
const valid = {
  NODE_ENV: "development",
  DB_NAME: "donanex",
  DB_USER: "donanex",
  DB_PASSWORD: crypto.randomBytes(18).toString("hex"),
  JWT_PRIVATE_KEY: keys.privateKey.replace(/\n/g, "\n"),
  JWT_PUBLIC_KEY: keys.publicKey.replace(/\n/g, "\n"),
  TOKEN_PEPPER: "p".repeat(40)
};

const problemsFor = (overrides: Record<string, string>) => validateConfig(loadConfig({ ...valid, ...overrides })).join(" | ");

test("Geçerli ayarlar kabul edilir", () => {
  assert.deepEqual(validateConfig(loadConfig(valid)), []);
});

test("PEM anahtarı tek satırdan geri açılır", () => {
  const config = loadConfig(valid);
  assert.ok(config.jwt.privateKey.includes("-----BEGIN PRIVATE KEY-----"));
  assert.ok(config.jwt.privateKey.includes("\n"), "satır sonları geri açılmalı");
});

test("Eksik veritabanı ayarı reddedilir", () => {
  assert.match(problemsFor({ DB_PASSWORD: "" }), /DB_NAME, DB_USER ve DB_PASSWORD/);
  assert.match(problemsFor({ DB_NAME: "" }), /DB_NAME/);
});

test("Zayıf veya eksik gizli değerler reddedilir", () => {
  assert.match(problemsFor({ TOKEN_PEPPER: "kisa" }), /TOKEN_PEPPER/);
  assert.match(problemsFor({ JWT_PRIVATE_KEY: "" }), /JWT_PRIVATE_KEY/);
  assert.match(problemsFor({ JWT_PRIVATE_KEY: "bu-bir-pem-degil" }), /PEM/);
  assert.match(problemsFor({ DB_PASSWORD: "parola123" }), /tahmin edilebilir/);
  assert.match(problemsFor({ BOOTSTRAP_ADMIN_PASSWORD: "kisa" }), /ADMIN_PASSWORD/);
});

test("Demo varsayılanları geliştirme ortamında geçerlidir", () => {
  const config = loadConfig({ ...valid, PAYMENTS_MODE: "simulated", SEED_DEMO_DATA: "true" });
  assert.equal(config.paymentsMode, "simulated");
  assert.equal(config.seedDemoData, true);
  assert.equal(config.cookieSecure, false);
  assert.deepEqual(validateConfig(config), []);
});

test("Üretimde güvensiz ayarlar sunucuyu başlatmaz", () => {
  const production = { NODE_ENV: "production" };

  // Üretim varsayılanları zaten güvenli: Secure çerez açık, benzetim kapalı.
  const config = loadConfig({ ...valid, ...production, PAYMENTS_MODE: "live" });
  assert.equal(config.cookieSecure, true);
  assert.deepEqual(validateConfig(config), []);

  assert.match(problemsFor({ ...production, COOKIE_SECURE: "false", PAYMENTS_MODE: "live" }), /COOKIE_SECURE/);
  assert.match(problemsFor({ ...production, PAYMENTS_MODE: "simulated" }), /PAYMENTS_MODE/);
  assert.match(problemsFor({ ...production, PAYMENTS_MODE: "live", SEED_DEMO_DATA: "true" }), /SEED_DEMO_DATA/);
});

test("PUBLIC_URL sondaki eğik çizgiden arındırılır ve issuer olur", () => {
  const config = loadConfig({ ...valid, PUBLIC_URL: "https://donanex.test/" });
  assert.equal(config.publicUrl, "https://donanex.test");
  assert.equal(config.issuer, "https://donanex.test");
});

test("PUBLIC_URL tünele çevrilse bile yerel giriş adresi kayıtlı kalır", () => {
  /*
   * Gerçek bir arıza: telefonda denemek için PUBLIC_URL bir tünel adresine
   * çevrilince bilgisayardaki giriş "redirect_uri bu istemci için kayıtlı
   * değil" diye kırıldı. Sebebi redirect_uris'in tek kaynağının PUBLIC_URL
   * olmasıydı.
   */
  const config = loadConfig({ ...valid, PUBLIC_URL: "https://rastgele-kelimeler.trycloudflare.com" });
  assert.ok(
    config.extraRedirectUris.includes("http://localhost:8090/auth/callback"),
    "geliştirmede yerel adres her zaman kabul edilmeli"
  );
  assert.ok(config.extraRedirectUris.includes("http://localhost:5173/auth/callback"), "Vite adresi de kalmalı");
});

test("Üretimde ek giriş adresi varsayılan olarak yoktur", () => {
  // localhost'a dönen bir redirect_uri üretimde yalnızca saldırı yüzeyi.
  const config = loadConfig({ ...valid, NODE_ENV: "production", PAYMENTS_MODE: "live" });
  assert.deepEqual(config.extraRedirectUris, []);
});

test("EXTRA_REDIRECT_URIS virgülle ayrılır ve boşluklar atılır", () => {
  const config = loadConfig({
    ...valid,
    EXTRA_REDIRECT_URIS: " https://a.test/auth/callback , https://b.test/auth/callback ,, "
  });
  assert.deepEqual(config.extraRedirectUris, ["https://a.test/auth/callback", "https://b.test/auth/callback"]);
});

test("Boş EXTRA_REDIRECT_URIS varsayılanı silmez", () => {
  /*
   * docker compose, tanımsız bir değişkeni BOŞ DİZE olarak geçiriyor.
   * Boş dize "verilmedi" sayılmazsa, ayarı compose'tan geçirmek yerel giriş
   * adreslerini sessizce siler ve hata ancak telefonda denerken çıkar.
   */
  const config = loadConfig({ ...valid, EXTRA_REDIRECT_URIS: "" });
  assert.ok(config.extraRedirectUris.includes("http://localhost:8090/auth/callback"));
});
