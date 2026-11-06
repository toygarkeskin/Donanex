"use strict";

/**
 * API süreci.
 *
 * Açılış sırası bilinçlidir: ayarlar doğrulanmadan hiçbir bağlantı kurulmaz,
 * şema hazır olmadan istek kabul edilmez.
 */
const { loadConfig, validateConfig } = require("./config/env");
const { createPool, waitForDatabase } = require("./infrastructure/persistence/postgres/pool");
const { runMigrations } = require("./infrastructure/persistence/postgres/migrate");
const { RedisCache } = require("./infrastructure/cache/RedisCache");
const { SeqLogger } = require("./infrastructure/logging/SeqLogger");
const { buildContainer } = require("./bootstrap/container");
const { syncRolesAndPermissions, ensureSystemAdmin } = require("./bootstrap/syncAccessControl");
const { syncOAuthClients } = require("./bootstrap/syncOAuthClients");
const { seedDemoData } = require("./bootstrap/demoSeed");
const { createApp } = require("./presentation/http/app");

async function start() {
  const config = loadConfig();

  const problems = validateConfig(config);
  if (problems.length) {
    console.error(`Geçersiz ayarlar:\n - ${problems.join("\n - ")}`);
    process.exit(1);
  }

  const logger = new SeqLogger({ ...config.logging, service: "donanex-api" });
  const pool = createPool(config.db);
  const cache = new RedisCache(config.redisUrl, logger);

  await waitForDatabase(pool, { log: (message) => logger.info(message) });
  await runMigrations(pool, (message) => logger.info(message));

  if (config.redisUrl) {
    try {
      await cache.connect();
      logger.info("Redis bağlantısı kuruldu");
    } catch (error) {
      logger.warn("Redis'e bağlanılamadı, önbellek devre dışı: {Reason}", { Reason: error.message });
    }
  }

  const { commands, queries, services } = buildContainer({ pool, cache, logger, config });
  services.redisClient = cache.available ? cache.client : null;

  // Görsel klasörü ilk yüklemede değil, açılışta hazırlanır.
  await services.fileStorage.init();

  await syncRolesAndPermissions(services.unitOfWork, logger);
  await syncOAuthClients({ ...services, config, logger });
  await ensureSystemAdmin({ ...services, config, logger });
  if (config.seedDemoData) await seedDemoData({ ...services, config, logger });

  const app = createApp({ commands, queries, services, config });

  const server = app.listen(config.port, () => {
    logger.info("API hazır: {Url}", { Url: `http://localhost:${config.port}/api`, PublicUrl: config.publicUrl });
    if (config.paymentsMode === "simulated") {
      logger.warn("Ödeme BENZETİM kipinde: gerçek para hareketi yok");
    }
    if (!config.cookieSecure) {
      logger.warn("Çerezler Secure değil — HTTPS arkasında COOKIE_SECURE=true yapın");
    }
  });

  const shutdown = async (signal) => {
    logger.info("{Signal} alındı, kapatılıyor", { Signal: signal });
    server.close(async () => {
      await Promise.allSettled([pool.end(), cache.close(), logger.close()]);
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

start().catch((error) => {
  console.error("Sunucu başlatılamadı:", error.message);
  console.error(error.stack);
  process.exit(1);
});
