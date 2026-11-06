"use strict";

/**
 * Composition root.
 *
 * Tüm somut sınıflar BURADA kurulur ve port isimlerine bağlanır. Başka hiçbir
 * dosya "hangi veritabanı", "hangi kuyruk" sorusunun cevabını bilmez; bu yüzden
 * bir altyapı bileşenini değiştirmek yalnızca bu dosyayı etkiler.
 *
 * Bağlamlar (bounded context) tek döngüyle kaydedilir: yeni bir bağlam eklemek
 * için burada kod değiştirmek gerekmez, MODULES listesine eklemek yeter.
 */
import type { Pool } from "pg";

import { CommandBus, QueryBus } from "../application/shared/cqrs/bus";
import { loggingMiddleware } from "../application/shared/cqrs/logging";
import { assertPorts } from "../application/shared/ports";
import type { Cache, Logger, Services } from "../application/shared/contracts";
import type { UseCaseContext } from "../application/shared/authorize";
import type { HandlerClass } from "../application/shared/registry";
import type { AppConfig } from "../config/env";

import identity = require("../application/identity");
import stores = require("../application/stores");
import catalog = require("../application/catalog");
import ordering = require("../application/ordering");
import support = require("../application/support");
import system = require("../application/system");

const MODULES = [identity, stores, catalog, ordering, support, system];

import { PgUnitOfWork } from "../infrastructure/persistence/postgres/PgUnitOfWork";
import { PgCatalogReadModel } from "../infrastructure/persistence/postgres/read-models/PgCatalogReadModel";
import { PgStoreReadModel } from "../infrastructure/persistence/postgres/read-models/PgStoreReadModel";
import { PgCartReadModel } from "../infrastructure/persistence/postgres/read-models/PgCartReadModel";
import { PgOrderReadModel } from "../infrastructure/persistence/postgres/read-models/PgOrderReadModel";
import { PgUserReadModel } from "../infrastructure/persistence/postgres/read-models/PgUserReadModel";
import { PgSupportReadModel } from "../infrastructure/persistence/postgres/read-models/PgSupportReadModel";
import { PgDashboardReadModel } from "../infrastructure/persistence/postgres/read-models/PgDashboardReadModel";
import { PgHealthReadModel } from "../infrastructure/persistence/postgres/read-models/PgHealthReadModel";

import { RsaTokenIssuer } from "../infrastructure/security/RsaTokenIssuer";
import { ScryptPasswordHasher } from "../infrastructure/security/ScryptPasswordHasher";
import { OpaqueTokenService } from "../infrastructure/security/OpaqueTokenService";
import { Pkce } from "../infrastructure/security/Pkce";
import { safeEqual } from "../infrastructure/security/safeEqual";
import { createMailer } from "../infrastructure/mail/NodemailerMailer";
import { LocalFileStorage } from "../infrastructure/storage/LocalFileStorage";
import { SystemClock } from "../infrastructure/support/Clock";
import { UuidGenerator } from "../infrastructure/support/Ids";

export interface ContainerDeps {
  readonly pool: Pool;
  /** Redis ya da bellek içi; ikisi de aynı Cache sözleşmesini karşılar. */
  readonly cache: Cache;
  readonly logger: Logger;
  readonly config: AppConfig;
}

/**
 * Yüklenen dosya deposu açılışta klasörünü hazırlayabilir.
 *
 * init() isteğe bağlıdır: uygulama katmanının sözleşmesinde yer almaz (dosyayı
 * nereye yazdığımız onun işi değil) ve testlerde overrides ile verilen sahte
 * bir depoda hiç bulunmayabilir. Bu yüzden çağıran `init?.()` ile çağırır.
 */
export interface BuiltServices extends Services {
  readonly fileStorage: Services["fileStorage"] & { init?(): Promise<void> };
}

export interface Container {
  readonly commands: CommandBus<UseCaseContext>;
  readonly queries: QueryBus<UseCaseContext>;
  readonly services: BuiltServices;
}

/**
 * @param deps      havuz, önbellek, günlükçü ve ayarlar
 * @param overrides testlerde sahte servis vermek için
 */
export function buildContainer(
  { pool, cache, logger, config }: ContainerDeps,
  overrides: Partial<Services> = {}
): Container {
  const clock = new SystemClock();

  const services: BuiltServices = {
    // yazma tarafı
    unitOfWork: new PgUnitOfWork(pool),

    // okuma tarafı
    catalogReadModel: new PgCatalogReadModel(pool),
    storeReadModel: new PgStoreReadModel(pool),
    cartReadModel: new PgCartReadModel(pool),
    orderReadModel: new PgOrderReadModel(pool),
    userReadModel: new PgUserReadModel(pool),
    supportReadModel: new PgSupportReadModel(pool),
    dashboardReadModel: new PgDashboardReadModel(pool),
    healthReadModel: new PgHealthReadModel(pool),

    // güvenlik
    tokenIssuer: new RsaTokenIssuer({
      privateKeyPem: config.jwt.privateKey,
      publicKeyPem: config.jwt.publicKey,
      issuer: config.issuer,
      clock
    }),
    passwordHasher: new ScryptPasswordHasher(),
    opaqueTokens: new OpaqueTokenService(config.tokenPepper),
    pkce: new Pkce(),
    safeEqual,

    // altyapı
    cache,
    mailer: createMailer(config.smtp, logger),
    fileStorage: new LocalFileStorage({ directory: config.uploadDir }),
    clock,
    ids: new UuidGenerator(),
    logger,

    // handler'ların ihtiyaç duyduğu ayarlar
    publicUrl: config.publicUrl,
    paymentsMode: config.paymentsMode,

    ...overrides
  };

  // Port sözleşmesi açılışta doğrulanır; eksik bir metot ilk istekte değil,
  // sunucu kalkarken yakalanır. (Derleme zamanı karşılığı: Services arayüzü.)
  assertPorts(services);

  const commands = new CommandBus<UseCaseContext>().use(loggingMiddleware(logger));
  const queries = new QueryBus<UseCaseContext>();

  for (const module of MODULES) {
    for (const [Message, Handler] of module.commandHandlers) {
      commands.register(Message, new (Handler as HandlerClass)(services));
    }
    for (const [Message, Handler] of module.queryHandlers) {
      queries.register(Message, new (Handler as HandlerClass)(services));
    }
  }

  logger.info("{Commands} komut ve {Queries} sorgu kaydedildi", {
    Commands: commands.registeredCount,
    Queries: queries.registeredCount
  });

  return { commands, queries, services };
}

export { MODULES };
