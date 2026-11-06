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
const { CommandBus, QueryBus } = require("../application/shared/cqrs/bus");
const { loggingMiddleware } = require("../application/shared/cqrs/logging");
const { assertPorts } = require("../application/shared/ports");

const MODULES = [
  require("../application/identity"),
  require("../application/stores"),
  require("../application/catalog"),
  require("../application/ordering"),
  require("../application/support"),
  require("../application/system")
];

const { PgUnitOfWork } = require("../infrastructure/persistence/postgres/PgUnitOfWork");
const { PgCatalogReadModel } = require("../infrastructure/persistence/postgres/read-models/PgCatalogReadModel");
const { PgStoreReadModel } = require("../infrastructure/persistence/postgres/read-models/PgStoreReadModel");
const { PgCartReadModel } = require("../infrastructure/persistence/postgres/read-models/PgCartReadModel");
const { PgOrderReadModel } = require("../infrastructure/persistence/postgres/read-models/PgOrderReadModel");
const { PgUserReadModel } = require("../infrastructure/persistence/postgres/read-models/PgUserReadModel");
const { PgSupportReadModel } = require("../infrastructure/persistence/postgres/read-models/PgSupportReadModel");
const { PgDashboardReadModel } = require("../infrastructure/persistence/postgres/read-models/PgDashboardReadModel");
const { PgHealthReadModel } = require("../infrastructure/persistence/postgres/read-models/PgHealthReadModel");

const { RsaTokenIssuer } = require("../infrastructure/security/RsaTokenIssuer");
const { ScryptPasswordHasher } = require("../infrastructure/security/ScryptPasswordHasher");
const { OpaqueTokenService } = require("../infrastructure/security/OpaqueTokenService");
const { Pkce } = require("../infrastructure/security/Pkce");
const { safeEqual } = require("../infrastructure/security/safeEqual");
const { createMailer } = require("../infrastructure/mail/NodemailerMailer");
const { LocalFileStorage } = require("../infrastructure/storage/LocalFileStorage");
const { SystemClock } = require("../infrastructure/support/Clock");
const { UuidGenerator } = require("../infrastructure/support/Ids");

/**
 * @param deps.pool   pg Pool
 * @param deps.cache  önbellek adaptörü (Redis ya da bellek içi)
 * @param deps.logger yapılandırılmış günlükçü
 * @param overrides   testlerde sahte servis vermek için
 */
function buildContainer({ pool, cache, logger, config }, overrides = {}) {
  const clock = new SystemClock();

  const services = {
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
  // sunucu kalkarken yakalanır.
  assertPorts(services);

  const commands = new CommandBus().use(loggingMiddleware(logger));
  const queries = new QueryBus();

  for (const module of MODULES) {
    for (const [Message, Handler] of module.commandHandlers) commands.register(Message, new Handler(services));
    for (const [Message, Handler] of module.queryHandlers) queries.register(Message, new Handler(services));
  }

  logger.info("{Commands} komut ve {Queries} sorgu kaydedildi", {
    Commands: commands.registeredCount,
    Queries: queries.registeredCount
  });

  return { commands, queries, services };
}

module.exports = { buildContainer, MODULES };
