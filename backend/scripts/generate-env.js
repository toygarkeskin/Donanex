#!/usr/bin/env node
"use strict";

/**
 * Gerekli tüm gizli değerleri üretip .env içeriğini standart çıktıya yazar.
 *
 *   node backend/scripts/generate-env.js > .env
 *
 * Mevcut bir .env varsa üzerine yazmadan önce yedekleyin; bu betik
 * hiçbir dosyaya dokunmaz, yalnızca metin üretir.
 *
 * --keep-smtp <dosya>  : verilen .env dosyasındaki SMTP_* değerlerini korur
 */

const crypto = require("crypto");
const fs = require("fs");

const args = process.argv.slice(2);
const keepSmtpFrom = args.includes("--keep-smtp") ? args[args.indexOf("--keep-smtp") + 1] : null;

/** PEM anahtarını tek satıra sığdırır; config/env.js okurken \n'leri geri açar. */
const inline = (pem) => pem.trim().replace(/\n/g, "\\n");

function readSmtp(file) {
  if (!file || !fs.existsSync(file)) return null;
  const found = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^(SMTP_[A-Z_]+)=(.*)$/);
    if (match && match[2].trim()) found[match[1]] = match[2];
  }
  return Object.keys(found).length ? found : null;
}

const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" }
});

const secret = (bytes) => crypto.randomBytes(bytes).toString("base64url");
const smtp = readSmtp(keepSmtpFrom);

const sections = [
  ["", { NODE_ENV: "development" }],
  ["Veritabanı", {
    DB_HOST: "127.0.0.1",
    DB_PORT: "5432",
    DB_NAME: "pazar",
    DB_USER: "pazar",
    DB_PASSWORD: secret(24)
  }],
  ["Jetonlar (RS256 imza anahtarı ve jeton özeti gizli değeri)", {
    JWT_PRIVATE_KEY: inline(privateKey),
    JWT_PUBLIC_KEY: inline(publicKey),
    TOKEN_PEPPER: crypto.randomBytes(32).toString("hex")
  }],
  ["Adresler ve portlar", {
    PUBLIC_URL: "http://localhost:8090",
    WEB_PORT: "8090",
    SEQ_PORT: "8092",
    MAILPIT_PORT: "8093",
    RABBITMQ_PORT: "8094",
    DB_PUBLISH_PORT: "5434",
    REDIS_PUBLISH_PORT: "6380",
    COOKIE_SECURE: "false"
  }],
  ["Kuyruk", {
    RABBITMQ_USER: "pazar",
    RABBITMQ_PASSWORD: secret(24)
  }],
  ["Günlükler", { LOG_LEVEL: "info", SEQ_API_KEY: "" }],
  ["E-posta — Docker'da Mailpit kullanılır, posta internete çıkmaz", smtp || {
    SMTP_HOST: "mail",
    SMTP_PORT: "1025",
    SMTP_SECURE: "false",
    SMTP_USER: "",
    SMTP_PASS: "",
    SMTP_FROM: "Pazar <bildirim@pazar.test>"
  }],
  ["İlk kurulum — parola boşsa rastgele üretilir ve günlüğe yazılır", {
    BOOTSTRAP_ADMIN_EMAIL: "admin@pazar.test",
    BOOTSTRAP_ADMIN_PASSWORD: "",
    SEED_DEMO_DATA: "true"
  }],
  ["Ödeme — simulated: gerçek para hareketi yok", { PAYMENTS_MODE: "simulated" }]
];

const out = ["# Bu dosya generate-env.js ile üretildi. Gizli değerler içerir, Git'e eklemeyin."];
for (const [title, values] of sections) {
  if (title) out.push("", `# --- ${title} ---`);
  for (const [key, value] of Object.entries(values)) out.push(`${key}=${value}`);
}
process.stdout.write(`${out.join("\n")}\n`);
