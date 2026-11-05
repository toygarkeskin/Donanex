"use strict";

const path = require("path");
const dotenv = require("dotenv");

// Önce backend/.env, sonra proje kökündeki .env okunur (ilk bulunan geçerli).
// Docker'da değerler compose tarafından verilir; .env dosyası imaja girmez.
dotenv.config({
  path: [path.resolve(__dirname, "../../.env"), path.resolve(__dirname, "../../../.env")],
  quiet: true
});

const MIN_SECRET_LENGTH = 32;
const PLACEHOLDER = /^(guclu-bir|change-?me|password|parola|secret|admin|test|123)/i;

function flag(value, fallback) {
  if (value === undefined || value === "") return fallback;
  return String(value).toLowerCase() === "true";
}

/** .env tek satırda tuttuğu için PEM'deki \n'ler geri açılır. */
const pem = (value) => (value ? String(value).replace(/\\n/g, "\n").trim() : "");

function loadConfig(env = process.env) {
  const isProduction = env.NODE_ENV === "production";
  const publicUrl = String(env.PUBLIC_URL || "http://localhost:8090").replace(/\/+$/, "");

  return Object.freeze({
    role: env.ROLE || "api",
    port: Number(env.PORT || 3000),
    isProduction,
    isTest: env.NODE_ENV === "test",
    publicUrl,
    // Jetonların "iss" alanı. Doğrulayan taraf bu değeri bekler.
    issuer: publicUrl,
    trustProxy: env.TRUST_PROXY ? Number(env.TRUST_PROXY) || env.TRUST_PROXY : false,
    cookieSecure: flag(env.COOKIE_SECURE, isProduction),
    paymentsMode: env.PAYMENTS_MODE || "simulated",
    seedDemoData: flag(env.SEED_DEMO_DATA, false),

    db: Object.freeze({
      host: env.DB_HOST || "127.0.0.1",
      port: Number(env.DB_PORT || 5432),
      database: env.DB_NAME,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      poolSize: Number(env.DB_POOL_SIZE || 10)
    }),

    redisUrl: env.REDIS_URL || "",
    rabbitUrl: env.RABBITMQ_URL || "",

    jwt: Object.freeze({
      privateKey: pem(env.JWT_PRIVATE_KEY),
      publicKey: pem(env.JWT_PUBLIC_KEY)
    }),
    tokenPepper: env.TOKEN_PEPPER || "",

    logging: Object.freeze({
      url: env.SEQ_URL || "",
      apiKey: env.SEQ_API_KEY || "",
      level: env.LOG_LEVEL || "info"
    }),

    smtp: Object.freeze({
      host: env.SMTP_HOST || "",
      port: Number(env.SMTP_PORT || 1025),
      secure: flag(env.SMTP_SECURE, false),
      user: env.SMTP_USER || "",
      pass: env.SMTP_PASS || "",
      from: env.SMTP_FROM || "Pazar <bildirim@pazar.test>"
    }),

    bootstrapAdmin: Object.freeze({
      email: env.BOOTSTRAP_ADMIN_EMAIL || "admin@pazar.test",
      password: env.BOOTSTRAP_ADMIN_PASSWORD || ""
    })
  });
}

/**
 * Eksik ya da zayıf ayarları listeler. Sunucu bu listeyle BAŞLAMAZ:
 * yanlış yapılandırılmış bir sistemin sessizce ayağa kalkıp güvensiz
 * çalışmasındansa, açılışta durup nedeni söylemesi yeğdir.
 */
function validateConfig(config) {
  const problems = [];

  if (!config.db.database || !config.db.user || !config.db.password) {
    problems.push("DB_NAME, DB_USER ve DB_PASSWORD zorunludur.");
  }
  if (!config.jwt.privateKey || !config.jwt.publicKey) {
    problems.push("JWT_PRIVATE_KEY ve JWT_PUBLIC_KEY zorunludur (generate-env.js ile üretin).");
  }
  if (config.jwt.privateKey && !config.jwt.privateKey.includes("PRIVATE KEY")) {
    problems.push("JWT_PRIVATE_KEY geçerli bir PEM değil.");
  }
  if (config.tokenPepper.length < MIN_SECRET_LENGTH) {
    problems.push(`TOKEN_PEPPER en az ${MIN_SECRET_LENGTH} karakter olmalıdır.`);
  }
  if (PLACEHOLDER.test(config.db.password || "")) {
    problems.push("DB_PASSWORD örnek veya tahmin edilebilir bir değer olamaz.");
  }
  if (config.bootstrapAdmin.password && config.bootstrapAdmin.password.length < 12) {
    problems.push("BOOTSTRAP_ADMIN_PASSWORD en az 12 karakter olmalıdır (ya da boş bırakın, üretilsin).");
  }

  if (config.isProduction) {
    if (!config.cookieSecure) {
      problems.push("Üretimde COOKIE_SECURE=true olmalıdır (HTTPS zorunlu).");
    }
    if (config.paymentsMode === "simulated") {
      problems.push("Üretimde PAYMENTS_MODE=simulated kullanılamaz; gerçek ödeme sağlayıcısı bağlanmalıdır.");
    }
    if (config.seedDemoData) {
      problems.push("Üretimde SEED_DEMO_DATA=true kullanılamaz.");
    }
  }

  return problems;
}

module.exports = { loadConfig, validateConfig };
