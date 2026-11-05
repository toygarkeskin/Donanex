"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { loadConfig, validateConfig } = require("../../src/config/env");

const good = {
  DB_NAME: "d",
  DB_USER: "u",
  DB_PASSWORD: "x".repeat(20),
  SESSION_SECRET: "s".repeat(32),
  ADMIN_USERNAME: "yonetici",
  ADMIN_PASSWORD: "z".repeat(20)
};

test("Geçerli ayarlar kabul edilir", () => {
  assert.deepEqual(validateConfig(loadConfig(good)), []);
});

test("Zayıf veya eksik ayarlarla sunucu başlamaz", () => {
  const problems = (env) => validateConfig(loadConfig({ ...good, ...env })).join(" ");
  assert.match(problems({ SESSION_SECRET: "kisa" }), /SESSION_SECRET/);
  assert.match(problems({ ADMIN_PASSWORD: "kisa" }), /ADMIN_PASSWORD/);
  assert.match(problems({ ADMIN_PASSWORD: "guclu-bir-yonetici-parolasi" }), /örnek/);
  assert.match(problems({ DB_PASSWORD: "" }), /DB_PASSWORD/);
});

test("Production varsayılanları güvenlidir", () => {
  const config = loadConfig({ ...good, NODE_ENV: "production" });
  assert.equal(config.cookieSecure, true);
  assert.equal(config.testPaymentsEnabled, false);
  const open = loadConfig({ ...good, NODE_ENV: "production", ENABLE_TEST_PAYMENTS: "true", COOKIE_SECURE: "false" });
  assert.equal(open.cookieSecure, false);
  assert.equal(open.testPaymentsEnabled, true);
});
