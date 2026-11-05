"use strict";

/**
 * Arka plan süreci.
 *
 * Üç iş yapar:
 *   1. Outbox'taki olayları RabbitMQ'ya aktarır (en-az-bir-kez teslim)
 *   2. Kuyruktaki olayları e-postaya çevirir
 *   3. Zamanlanmış bakım işlerini çalıştırır
 *
 * API'den ayrı bir süreçtir: yavaş bir SMTP sunucusu ya da dolu bir kuyruk
 * müşterinin isteğini bekletmez.
 */
const { loadConfig, validateConfig } = require("./config/env");
const { createPool, waitForDatabase } = require("./infrastructure/persistence/postgres/pool");
const { RedisCache } = require("./infrastructure/cache/RedisCache");
const { SeqLogger } = require("./infrastructure/logging/SeqLogger");
const { RabbitMqBroker } = require("./infrastructure/messaging/RabbitMqBroker");
const { OutboxRelay } = require("./infrastructure/messaging/OutboxRelay");
const { buildContainer } = require("./bootstrap/container");
const { startScheduler } = require("./bootstrap/scheduler");
const { startEmailConsumer } = require("./bootstrap/emailConsumer");

async function start() {
  const config = loadConfig();

  const problems = validateConfig(config);
  if (problems.length) {
    console.error(`Geçersiz ayarlar:\n - ${problems.join("\n - ")}`);
    process.exit(1);
  }

  const logger = new SeqLogger({ ...config.logging, service: "pazar-worker" });
  const pool = createPool({ ...config.db, poolSize: 5 });
  const cache = new RedisCache(config.redisUrl, logger);

  await waitForDatabase(pool, { log: (message) => logger.info(message) });
  if (config.redisUrl) await cache.connect().catch(() => {});

  const { commands, services } = buildContainer({ pool, cache, logger, config });

  const broker = new RabbitMqBroker(config.rabbitUrl, logger);
  await broker.connect();
  logger.info("RabbitMQ bağlantısı kuruldu");

  await startEmailConsumer({ broker, mailer: services.mailer, config, logger });

  const relay = new OutboxRelay({ unitOfWork: services.unitOfWork, broker, logger });
  relay.start();

  const stopScheduler = startScheduler({ commands, unitOfWork: services.unitOfWork, logger });
  logger.info("Worker hazır: outbox aktarımı, e-posta tüketicisi ve bakım işleri çalışıyor");

  const shutdown = async (signal) => {
    logger.info("{Signal} alındı, kapatılıyor", { Signal: signal });
    relay.stop();
    stopScheduler();
    await Promise.allSettled([broker.close(), pool.end(), cache.close(), logger.close()]);
    process.exit(0);
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

start().catch((error) => {
  console.error("Worker başlatılamadı:", error.message);
  console.error(error.stack);
  process.exit(1);
});
