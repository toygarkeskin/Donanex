"use strict";

/**
 * API süreci.
 *
 * Açılış sırası bilinçlidir: ayarlar doğrulanmadan hiçbir bağlantı kurulmaz,
 * şema hazır olmadan istek kabul edilmez.
 */
import { loadConfig, validateConfig } from "./config/env";
import { createPool, waitForDatabase } from "./infrastructure/persistence/postgres/pool";
import { runMigrations } from "./infrastructure/persistence/postgres/migrate";
import { RedisCache } from "./infrastructure/cache/RedisCache";
import { SeqLogger } from "./infrastructure/logging/SeqLogger";
import { buildContainer } from "./bootstrap/container";
import { syncRolesAndPermissions, ensureSystemAdmin } from "./bootstrap/syncAccessControl";
import { syncOAuthClients } from "./bootstrap/syncOAuthClients";
import { seedDemoData } from "./bootstrap/demoSeed";
import { createApp } from "./presentation/http/app";

async function start(): Promise<void> {
  const config = loadConfig();

  const problems = validateConfig(config);
  if (problems.length) {
    console.error(`Geçersiz ayarlar:\n - ${problems.join("\n - ")}`);
    process.exit(1);
  }

  const logger = new SeqLogger({ ...config.logging, service: "donanex-api" });
  const pool = createPool(config.db);
  const cache = new RedisCache(config.redisUrl, logger);

  await waitForDatabase(pool, { log: (message: string) => logger.info(message) });
  await runMigrations(pool, (message: string) => logger.info(message));

  if (config.redisUrl) {
    try {
      await cache.connect();
      logger.info("Redis bağlantısı kuruldu");
    } catch (error) {
      const mesaj = error instanceof Error ? error.message : String(error);
      logger.warn("Redis'e bağlanılamadı, önbellek devre dışı: {Reason}", { Reason: mesaj });
    }
  }

  const { commands, queries, services } = buildContainer({ pool, cache, logger, config });

  // Görsel klasörü ilk yüklemede değil, açılışta hazırlanır.
  await services.fileStorage.init?.();

  await syncRolesAndPermissions(services.unitOfWork, logger);
  await syncOAuthClients({ ...services, config, logger });
  await ensureSystemAdmin({ ...services, config, logger });
  if (config.seedDemoData) await seedDemoData({ ...services, config, logger });

  const app = createApp({
    commands,
    queries,
    services,
    config,
    // İstek sınırı sayaçları Redis'te tutulur. Ham istemci BURADAN geçirilir:
    // eskiden container'ın ürettiği servis torbasına sonradan ekleniyordu, ama
    // redisClient bir port değil — yalnızca HTTP katmanının sınırlayıcısı
    // kullanır. Bağlantı yoksa sayaçlar sürecin içinde tutulur.
    redisClient: cache.available ? cache.client : null
  });

  const server = app.listen(config.port, () => {
    logger.info("API hazır: {Url}", { Url: `http://localhost:${config.port}/api`, PublicUrl: config.publicUrl });
    if (config.paymentsMode === "simulated") {
      logger.warn("Ödeme BENZETİM kipinde: gerçek para hareketi yok");
    }
    if (!config.cookieSecure) {
      logger.warn("Çerezler Secure değil — HTTPS arkasında COOKIE_SECURE=true yapın");
    }
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info("{Signal} alındı, kapatılıyor", { Signal: signal });
    server.close(async () => {
      await Promise.allSettled([pool.end(), cache.close(), logger.close()]);
      process.exit(0);
    });
    // Açık bağlantılar kapanmazsa süreç sonsuza dek beklemesin.
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

start().catch((error: unknown) => {
  const hata = error instanceof Error ? error : new Error(String(error));
  console.error("Sunucu başlatılamadı:", hata.message);
  console.error(hata.stack);
  process.exit(1);
});
