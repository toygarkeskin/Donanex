"use strict";

const { loadConfig, validateConfig } = require("./config/env");
const { createPool, waitForDatabase } = require("./infrastructure/persistence/postgres/pool");
const { runMigrations } = require("./infrastructure/persistence/postgres/migrate");
const { seedProductsIfEmpty } = require("./infrastructure/persistence/postgres/seed");
const { buildContainer } = require("./bootstrap/container");
const { startScheduler } = require("./bootstrap/scheduler");
const { createApp } = require("./presentation/http/app");

async function start() {
  const config = loadConfig();

  const problems = validateConfig(config);
  if (problems.length) {
    throw new Error(`Geçersiz ayarlar:\n - ${problems.join("\n - ")}`);
  }

  const pool = createPool(config.db);

  await waitForDatabase(pool);
  await runMigrations(pool);
  await seedProductsIfEmpty(pool);

  const { commands, queries } = buildContainer({ pool, config });
  const app = createApp({ commands, queries, config });
  const stopScheduler = startScheduler({ commands, config });

  const server = app.listen(config.port, () => {
    console.log(`API çalışıyor: http://localhost:${config.port}/api`);
    if (config.testPaymentsEnabled) console.warn("UYARI: Test ödeme uçları AÇIK (ENABLE_TEST_PAYMENTS).");
    if (!config.cookieSecure) console.warn("UYARI: Çerezler Secure değil. HTTPS arkasında COOKIE_SECURE=true yapın.");
  });

  const shutdown = (signal) => {
    console.log(`${signal} alındı, kapatılıyor...`);
    stopScheduler();
    server.close(() => pool.end().finally(() => process.exit(0)));
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

start().catch((error) => {
  console.error("Sunucu başlatılamadı:", error.message);
  process.exit(1);
});
