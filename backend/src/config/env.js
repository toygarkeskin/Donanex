"use strict";

const path = require("path");
const dotenv = require("dotenv");

// Önce backend/.env, sonra proje kökündeki .env okunur (ilk bulunan değer geçerli).
// Docker'da değişkenler compose tarafından verilir; .env dosyası imaja girmez.
dotenv.config({
  path: [path.resolve(__dirname, "../../.env"), path.resolve(__dirname, "../../../.env")],
  quiet: true
});

const MIN_SECRET_LENGTH = 32;
const PLACEHOLDER = /^(guclu-bir|change-?me|password|parola|admin|123)/i;

function flag(value, fallback) {
  if (value === undefined || value === "") return fallback;
  return String(value).toLowerCase() === "true";
}

function loadConfig(env = process.env) {
  const isProduction = env.NODE_ENV === "production";
  const port = Number(env.PORT || 3000);

  return Object.freeze({
    port,
    isProduction,
    // nginx arkasında gerçek istemci IP'si için (rate limit doğru çalışsın)
    trustProxy: env.TRUST_PROXY ? Number(env.TRUST_PROXY) || env.TRUST_PROXY : false,
    // HTTPS arkasında true olmalı. Varsayılan: production'da açık.
    cookieSecure: flag(env.COOKIE_SECURE, isProduction),
    // Test ödeme uçları. Varsayılan: production'da kapalı.
    testPaymentsEnabled: flag(env.ENABLE_TEST_PAYMENTS, !isProduction),
    // E-postadaki bağlantılar bu adresten üretilir; istekteki Host başlığına güvenilmez.
    publicUrl: String(env.PUBLIC_URL || `http://localhost:${env.WEB_PORT || 8080}`).replace(/\/+$/, ""),
    orderPaymentTtlMinutes: Number(env.ORDER_PAYMENT_TTL_MINUTES || 60),

    db: Object.freeze({
      host: env.DB_HOST || "127.0.0.1",
      port: Number(env.DB_PORT || 5432),
      database: env.DB_NAME,
      user: env.DB_USER,
      password: env.DB_PASSWORD
    }),

    admin: Object.freeze({
      username: env.ADMIN_USERNAME || "",
      password: env.ADMIN_PASSWORD || ""
    }),

    sessionSecret: env.SESSION_SECRET || "",

    smtp: Object.freeze({
      host: env.SMTP_HOST || "",
      port: Number(env.SMTP_PORT || 465),
      secure: String(env.SMTP_SECURE).toLowerCase() === "true",
      user: env.SMTP_USER || "",
      pass: env.SMTP_PASS || "",
      from: env.SMTP_FROM || env.SMTP_USER || ""
    })
  });
}

/** Eksik/zayıf ayarları listeler. Sunucu bu listeyle başlamayı reddeder. */
function validateConfig(config) {
  const problems = [];
  if (!config.db.database || !config.db.user || !config.db.password) {
    problems.push("DB_NAME, DB_USER ve DB_PASSWORD zorunludur.");
  }
  if (config.sessionSecret.length < MIN_SECRET_LENGTH) {
    problems.push(`SESSION_SECRET en az ${MIN_SECRET_LENGTH} karakter olmalıdır.`);
  }
  if (!config.admin.username || !config.admin.password) {
    problems.push("ADMIN_USERNAME ve ADMIN_PASSWORD zorunludur.");
  }
  if (config.admin.password.length > 0 && config.admin.password.length < 12) {
    problems.push("ADMIN_PASSWORD en az 12 karakter olmalıdır.");
  }
  if (PLACEHOLDER.test(config.admin.password) || PLACEHOLDER.test(config.db.password || "")) {
    problems.push("ADMIN_PASSWORD / DB_PASSWORD örnek veya tahmin edilebilir bir değer olamaz.");
  }
  if (!Number.isInteger(config.orderPaymentTtlMinutes) || config.orderPaymentTtlMinutes < 1) {
    problems.push("ORDER_PAYMENT_TTL_MINUTES pozitif tam sayı olmalıdır.");
  }
  return problems;
}

module.exports = { loadConfig, validateConfig };
