"use strict";

const express = require("express");
const helmet = require("helmet");

const { createSessionResolver, createAuthGuards } = require("./middleware/auth");
const { createRateLimiters } = require("./middleware/rateLimiters");
const { originGuard } = require("./middleware/originGuard");
const { requestLogger } = require("./middleware/requestLogger");
const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");
const { healthRoutes } = require("./routes/health.routes");
const { catalogRoutes } = require("./routes/catalog.routes");
const { orderRoutes } = require("./routes/orders.routes");
const { customerRoutes } = require("./routes/customers.routes");
const { supportRoutes } = require("./routes/support.routes");
const { adminRoutes } = require("./routes/admin.routes");

const BULK_IMPORT_PATH = "/api/admin/products/bulk";

/**
 * Yalnızca JSON API sunar. Statik sayfaları frontend (nginx) konteyneri sunar
 * ve /api isteklerini buraya yönlendirir.
 */
function createApp({ commands, queries, config, rateLimits = true, log = console.log }) {
  const app = express();

  app.disable("x-powered-by");
  if (config.trustProxy) app.set("trust proxy", config.trustProxy);

  app.use(
    helmet({
      contentSecurityPolicy: { useDefaults: false, directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
      strictTransportSecurity: config.cookieSecure
    })
  );
  app.use(requestLogger(log));

  // Bedava ve yüksek hacimli kontrol: rate limit'e takılmasın, oturum aramasın.
  app.use("/api", healthRoutes({ queries }));

  const limiters = createRateLimiters({ enabled: rateLimits });
  const auth = createAuthGuards();
  const ctx = { commands, queries, auth, limiters, config };

  const smallBody = express.json({ limit: "32kb" });
  const largeBody = express.json({ limit: "1mb" }); // yalnızca CSV ile toplu ürün için

  const api = express.Router();
  api.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  api.use(limiters.api);
  api.use(originGuard);
  api.use((req, res, next) => (req.originalUrl.split("?")[0] === BULK_IMPORT_PATH ? largeBody : smallBody)(req, res, next));
  api.use(createSessionResolver({ queries }));

  api.use(catalogRoutes(ctx));
  api.use(orderRoutes(ctx));
  api.use(supportRoutes(ctx));
  api.use("/customers", customerRoutes(ctx));
  api.use("/admin", adminRoutes(ctx));
  api.use(notFoundHandler);

  app.use("/api", api);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
