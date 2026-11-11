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
import { loadConfig, validateConfig } from "./config/env";
import { createPool, waitForDatabase } from "./infrastructure/persistence/postgres/pool";
import { RedisCache } from "./infrastructure/cache/RedisCache";
import { SeqLogger } from "./infrastructure/logging/SeqLogger";
import { RabbitMqBroker } from "./infrastructure/messaging/RabbitMqBroker";
import { OutboxRelay } from "./infrastructure/messaging/OutboxRelay";
import { RedisNotificationStream } from "./infrastructure/notifications/RedisNotificationStream";
import { buildContainer } from "./bootstrap/container";
import { startScheduler } from "./bootstrap/scheduler";
import { startEmailConsumer } from "./bootstrap/emailConsumer";
import { startNotificationConsumer } from "./bootstrap/notificationConsumer";

async function start(): Promise<void> {
  const config = loadConfig();

  const problems = validateConfig(config);
  if (problems.length) {
    console.error(`Geçersiz ayarlar:\n - ${problems.join("\n - ")}`);
    process.exit(1);
  }

  const logger = new SeqLogger({ ...config.logging, service: "donanex-worker" });
  const pool = createPool({ ...config.db, poolSize: 5 });
  const cache = new RedisCache(config.redisUrl, logger);

  await waitForDatabase(pool, { log: (message: string) => logger.info(message) });
  if (config.redisUrl) await cache.connect().catch(() => {});

  const { commands, services } = buildContainer({ pool, cache, logger, config });

  const broker = new RabbitMqBroker(config.rabbitUrl, logger);
  await broker.connect();
  logger.info("RabbitMQ bağlantısı kuruldu");

  await startEmailConsumer({ broker, mailer: services.mailer, config, logger });

  /*
   * Site içi bildirimler. Gerçek zamanlı kanal Redis'e bağlı: yoksa bildirim
   * yine veritabanına yazılır, yalnızca ekrana düşmesi istemcinin yoklamasını
   * bekler.
   */
  const stream = cache.available ? new RedisNotificationStream(cache.client, logger) : null;
  if (!stream) logger.warn("Redis yok: bildirimler yazılır ama anında iletilmez");
  await startNotificationConsumer({ broker, commands, stream, logger });

  const relay = new OutboxRelay({ unitOfWork: services.unitOfWork, broker, logger });
  relay.start();

  const stopScheduler = startScheduler({ commands, unitOfWork: services.unitOfWork, logger });
  logger.info("Worker hazır: outbox aktarımı, e-posta tüketicisi ve bakım işleri çalışıyor");

  const shutdown = async (signal: string): Promise<void> => {
    logger.info("{Signal} alındı, kapatılıyor", { Signal: signal });
    relay.stop();
    stopScheduler();
    await Promise.allSettled([broker.close(), pool.end(), cache.close(), logger.close()]);
    process.exit(0);
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

start().catch((error: unknown) => {
  const hata = error instanceof Error ? error : new Error(String(error));
  console.error("Worker başlatılamadı:", hata.message);
  console.error(hata.stack);
  process.exit(1);
});
