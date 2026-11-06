"use strict";

const express = require("express");
const helmet = require("helmet");

const { requestContext, accessLog } = require("./middleware/requestContext");
const { authenticate } = require("./middleware/authenticate");
const { cartSession } = require("./middleware/cartSession");
const { originGuard } = require("./middleware/originGuard");
const { createRateLimiters } = require("./middleware/rateLimiters");
const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");

const { healthRoutes } = require("./routes/health.routes");
const { oauthRoutes } = require("./routes/oauth.routes");
const { authRoutes } = require("./routes/auth.routes");
const { catalogRoutes } = require("./routes/catalog.routes");
const { cartRoutes } = require("./routes/cart.routes");
const { orderRoutes } = require("./routes/orders.routes");
const { accountRoutes } = require("./routes/account.routes");
const { storePanelRoutes } = require("./routes/store.routes");
const { adminRoutes } = require("./routes/admin.routes");
const { supportRoutes } = require("./routes/support.routes");
const { uploadRoutes } = require("./routes/uploads.routes");

const BULK_IMPORT = /\/products\/bulk$/;

/**
 * JSON API. Statik dosyaları web (nginx) konteyneri sunar ve /api ile /oauth
 * isteklerini buraya yönlendirir.
 *
 * Express 5 kullanılıyor: async rota fonksiyonlarındaki hatalar kendiliğinden
 * errorHandler'a iletilir, her rotayı try/catch ile sarmak gerekmez.
 */
function createApp({ commands, queries, services, config, rateLimits = true }) {
  const app = express();
  const logger = services.logger;

  app.disable("x-powered-by");
  if (config.trustProxy) app.set("trust proxy", config.trustProxy);

  app.use(
    helmet({
      // API yalnızca JSON döndürür; hiçbir kaynağı yüklemesine gerek yok.
      contentSecurityPolicy: { useDefaults: false, directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
      strictTransportSecurity: config.cookieSecure,
      crossOriginResourcePolicy: { policy: "same-origin" }
    })
  );
  app.use(requestContext(logger));

  // Sağlık uçları: sık çağrılır, sınırlara ve oturum çözümüne takılmasın.
  app.use("/api", healthRoutes({ queries }));

  // Yüklenen ürün görselleri. Oturum çözümünden ve gövde ayrıştırmadan önce:
  // statik içeriktir, hiçbirine ihtiyacı yoktur.
  app.use("/yuklenen", uploadRoutes({ services }));

  app.use(accessLog());

  const limiters = createRateLimiters({ enabled: rateLimits, redisClient: services.redisClient });
  const json = express.json({ limit: "64kb" });
  const largeJson = express.json({ limit: "1mb" }); // yalnızca CSV ile toplu ürün
  const form = express.urlencoded({ extended: false, limit: "16kb" }); // OAuth jeton ucu

  const context = { commands, queries, services, config, limiters };

  /* ---------- OAuth 2.1 / OIDC ---------- */
  // Keşif belgesi ve JWKS kök altında durur (RFC 8414).
  app.use("/.well-known", oauthRoutes.discovery(context));
  // userinfo ucu Bearer jeton ister; bu yüzden /oauth da oturumu çözer.
  app.use(
    "/oauth",
    limiters.api,
    form,
    json,
    authenticate({ tokenIssuer: services.tokenIssuer, queries }),
    oauthRoutes.endpoints(context)
  );

  /* ---------- Uygulama API'si ---------- */
  const api = express.Router();
  api.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  api.use(limiters.api);
  api.use(originGuard);
  api.use((req, res, next) => (BULK_IMPORT.test(req.path) ? largeJson : json)(req, res, next));
  api.use(authenticate({ tokenIssuer: services.tokenIssuer, queries }));
  api.use(cartSession({ cookieSecure: config.cookieSecure }));

  api.use("/auth", authRoutes(context));
  api.use(catalogRoutes(context));
  api.use("/cart", cartRoutes(context));
  api.use(orderRoutes(context));
  api.use("/me", accountRoutes(context));
  api.use("/stores", storePanelRoutes(context));
  api.use("/admin", adminRoutes(context));
  api.use(supportRoutes(context));
  api.use(notFoundHandler);

  app.use("/api", api);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
