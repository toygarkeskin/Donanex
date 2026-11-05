"use strict";

/**
 * Composition root: somut altyapı sınıflarını oluşturur, port sözleşmesini doğrular
 * ve her bağlamın (bounded context) handler'larını Command/Query bus'larına kaydeder.
 * Katmanlar arasındaki tüm "bağlama" yalnızca burada yapılır.
 */

const { CommandBus, QueryBus } = require("../application/shared/cqrs/bus");
const { assertPorts } = require("../application/shared/ports");
const catalog = require("../application/catalog");
const ordering = require("../application/ordering");
const customers = require("../application/customers");
const support = require("../application/support");
const identity = require("../application/identity");
const system = require("../application/system");

const { PgUnitOfWork } = require("../infrastructure/persistence/postgres/PgUnitOfWork");
const { PgProductReadModel } = require("../infrastructure/persistence/postgres/read-models/PgProductReadModel");
const { PgOrderReadModel } = require("../infrastructure/persistence/postgres/read-models/PgOrderReadModel");
const { PgCustomerReadModel } = require("../infrastructure/persistence/postgres/read-models/PgCustomerReadModel");
const { PgSupportReadModel } = require("../infrastructure/persistence/postgres/read-models/PgSupportReadModel");
const { PgSessionReadModel } = require("../infrastructure/persistence/postgres/read-models/PgSessionReadModel");
const { PgHealthReadModel } = require("../infrastructure/persistence/postgres/read-models/PgHealthReadModel");
const { HmacTokenService } = require("../infrastructure/security/HmacTokenService");
const { ScryptPasswordHasher } = require("../infrastructure/security/ScryptPasswordHasher");
const { OpaqueTokenService } = require("../infrastructure/security/OpaqueTokenService");
const { safeEqual } = require("../infrastructure/security/safeEqual");
const { createMailer } = require("../infrastructure/mail/createMailer");

const MODULES = [catalog, ordering, customers, support, identity, system];

/**
 * @param deps.pool  pg Pool (yazma ve okuma tarafı aynı veritabanını kullanır;
 *                   istenirse read model'ler bir okuma replikasına bağlanabilir)
 * @param overrides  testlerde sahte servis vermek için
 */
function buildContainer({ pool, config }, overrides = {}) {
  const services = {
    unitOfWork: new PgUnitOfWork(pool),
    productReadModel: new PgProductReadModel(pool),
    orderReadModel: new PgOrderReadModel(pool),
    customerReadModel: new PgCustomerReadModel(pool),
    supportReadModel: new PgSupportReadModel(pool),
    sessionReadModel: new PgSessionReadModel(pool),
    healthReadModel: new PgHealthReadModel(pool),
    tokenService: new HmacTokenService(config.sessionSecret),
    passwordHasher: new ScryptPasswordHasher(),
    opaqueTokens: new OpaqueTokenService(),
    mailer: createMailer(config.smtp),
    adminCredentials: config.admin,
    publicUrl: config.publicUrl,
    safeEqual,
    ...overrides
  };

  assertPorts(services);

  const commands = new CommandBus();
  const queries = new QueryBus();

  for (const { commandHandlers, queryHandlers } of MODULES) {
    for (const [Command, Handler] of commandHandlers) commands.register(Command, new Handler(services));
    for (const [Query, Handler] of queryHandlers) queries.register(Query, new Handler(services));
  }

  return { commands, queries, services };
}

module.exports = { buildContainer };
