"use strict";

import path from "node:path";
import dotenv from "dotenv";

import type { DbConfig } from "../infrastructure/persistence/postgres/pool";
import type { LogLevel } from "../infrastructure/logging/SeqLogger";
import type { SmtpConfig } from "../infrastructure/mail/NodemailerMailer";

// Önce backend/.env, sonra proje kökündeki .env okunur (ilk bulunan geçerli).
// Docker'da değerler compose tarafından verilir; .env dosyası imaja girmez.
dotenv.config({
  path: [path.resolve(__dirname, "../../.env"), path.resolve(__dirname, "../../../.env")],
  quiet: true
});

const MIN_SECRET_LENGTH = 32;
const PLACEHOLDER = /^(guclu-bir|change-?me|password|parola|secret|admin|test|123)/i;

function flag(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === "") return fallback;
  return String(value).toLowerCase() === "true";
}

/** .env tek satırda tuttuğu için PEM'deki \n'ler geri açılır. */
const pem = (value: string | undefined): string => (value ? String(value).replace(/\\n/g, "\n").trim() : "");

/** Çalışma zamanı ayarları. Tamamı dondurulmuştur: açılıştan sonra değişmez. */
export interface AppConfig {
  readonly role: string;
  readonly port: number;
  readonly isProduction: boolean;
  readonly isTest: boolean;
  readonly publicUrl: string;
  /** PUBLIC_URL'in yanında giriş dönüşü için kabul edilecek EK adresler. */
  readonly extraRedirectUris: readonly string[];
  /** Jetonların "iss" alanı. Doğrulayan taraf bu değeri bekler. */
  readonly issuer: string;
  /** Express'in "trust proxy" ayarı: atlanacak vekil sayısı ya da false. */
  readonly trustProxy: number | string | false;
  readonly cookieSecure: boolean;
  readonly paymentsMode: string;
  readonly seedDemoData: boolean;
  readonly uploadDir: string;
  readonly db: DbConfig;
  readonly redisUrl: string;
  readonly rabbitUrl: string;
  readonly jwt: { readonly privateKey: string; readonly publicKey: string };
  readonly tokenPepper: string;
  readonly logging: { readonly url: string; readonly apiKey: string; readonly level: LogLevel };
  readonly smtp: SmtpConfig;
  readonly bootstrapAdmin: { readonly email: string; readonly password: string };
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const isProduction = env.NODE_ENV === "production";
  const publicUrl = String(env.PUBLIC_URL || "http://localhost:8090").replace(/\/+$/, "");

  return Object.freeze({
    role: env.ROLE || "api",
    port: Number(env.PORT || 3000),
    isProduction,
    isTest: env.NODE_ENV === "test",
    publicUrl,
    /*
     * Giriş dönüşünün kabul edileceği EK adresler.
     *
     * redirect_uris'in tek kaynağı PUBLIC_URL olduğunda, PUBLIC_URL'i bir
     * tünele çevirmek YERELDEKİ girişi anında kırıyor: tarayıcı
     * http://localhost:8090/auth/callback gönderiyor, kayıtlı tek adres
     * tünelin adresi oluyor, istek "redirect_uri kayıtlı değil" diye
     * reddediliyor. Telefonda denemek için PUBLIC_URL'i değiştirmek olağan
     * bir iş olduğundan geliştirmede yerel adresler HER ZAMAN kayıtlı kalır.
     *
     * Üretimde varsayılan BOŞ: orada localhost'a dönen bir redirect_uri
     * tutmanın faydası yok, yalnızca saldırı yüzeyini genişletir.
     *
     * WEB_PORT'u değiştirdiysen bu değişkeni elle vermen gerekir; api
     * konteyneri compose'un yayın portunu görmüyor.
     */
    extraRedirectUris: Object.freeze(
      String(
        // Boş dize de "verilmedi" sayılır: compose tanımsız değişkeni boş
        // geçiriyor, "??" buna düşmediği için varsayılan kaybolurdu.
        env.EXTRA_REDIRECT_URIS ||
          (isProduction ? "" : "http://localhost:8090/auth/callback,http://localhost:5173/auth/callback")
      )
        .split(",")
        .map((adres) => adres.trim())
        .filter(Boolean)
    ),
    // Jetonların "iss" alanı. Doğrulayan taraf bu değeri bekler.
    issuer: publicUrl,
    trustProxy: env.TRUST_PROXY ? Number(env.TRUST_PROXY) || env.TRUST_PROXY : false,
    cookieSecure: flag(env.COOKIE_SECURE, isProduction),
    paymentsMode: env.PAYMENTS_MODE || "simulated",
    seedDemoData: flag(env.SEED_DEMO_DATA, false),
    // Yüklenen ürün görsellerinin yeri. Konteynerde kalıcı bir volume;
    // yerel çalışmada proje altındaki var/ klasörü (git tarafından yok sayılır).
    uploadDir: env.UPLOAD_DIR || "./var/uploads",

    db: Object.freeze({
      host: env.DB_HOST || "127.0.0.1",
      port: Number(env.DB_PORT || 5432),
      database: env.DB_NAME!,
      user: env.DB_USER!,
      password: env.DB_PASSWORD!,
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
      level: (env.LOG_LEVEL || "info") as LogLevel
    }),

    smtp: Object.freeze({
      host: env.SMTP_HOST || "",
      port: Number(env.SMTP_PORT || 1025),
      secure: flag(env.SMTP_SECURE, false),
      user: env.SMTP_USER || "",
      pass: env.SMTP_PASS || "",
      from: env.SMTP_FROM || "Donanex <bildirim@donanex.test>"
    }),

    bootstrapAdmin: Object.freeze({
      email: env.BOOTSTRAP_ADMIN_EMAIL || "admin@donanex.test",
      password: env.BOOTSTRAP_ADMIN_PASSWORD || ""
    })
  });
}

/**
 * Eksik ya da zayıf ayarları listeler. Sunucu bu listeyle BAŞLAMAZ:
 * yanlış yapılandırılmış bir sistemin sessizce ayağa kalkıp güvensiz
 * çalışmasındansa, açılışta durup nedeni söylemesi yeğdir.
 *
 * db.database/user/password tipte string yazılıdır ama ortam değişkeni
 * verilmemiş olabilir; bu yüzden burada gerçekten var mı diye bakılır.
 */
export function validateConfig(config: AppConfig): string[] {
  const problems: string[] = [];

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
