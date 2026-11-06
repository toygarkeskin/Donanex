"use strict";

import express, { type Express } from "express";
import helmet from "helmet";

import { requestContext, accessLog, type ChildLogger } from "./middleware/requestContext";
import { authenticate } from "./middleware/authenticate";
import { cartSession } from "./middleware/cartSession";
import { originGuard } from "./middleware/originGuard";
import { createRateLimiters, type RateLimitRedisClient } from "./middleware/rateLimiters";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";

import { healthRoutes } from "./routes/health.routes";
import { oauthRoutes } from "./routes/oauth.routes";
import { authRoutes } from "./routes/auth.routes";
import { catalogRoutes } from "./routes/catalog.routes";
import { cartRoutes } from "./routes/cart.routes";
import { orderRoutes } from "./routes/orders.routes";
import { accountRoutes } from "./routes/account.routes";
import { storePanelRoutes } from "./routes/store.routes";
import { adminRoutes } from "./routes/admin.routes";
import { supportRoutes } from "./routes/support.routes";
import { uploadRoutes } from "./routes/uploads.routes";

import type { RouteContext } from "./types";
import type { Services } from "../../application/shared/contracts";
import type { CommandBus, QueryBus } from "../../application/shared/cqrs/bus";
import type { UseCaseContext } from "../../application/shared/authorize";
import type { AppConfig } from "../../config/env";

const BULK_IMPORT = /\/products\/bulk$/;

export interface CreateAppOptions {
  readonly commands: CommandBus<UseCaseContext>;
  readonly queries: QueryBus<UseCaseContext>;
  readonly services: Services;
  readonly config: AppConfig;
  /**
   * İstek sınırı sayaçları için ham Redis istemcisi.
   *
   * Bir PORT DEĞİL: yalnızca bu katmanın sınırlayıcısı kullanır, uygulama
   * katmanı bilmez. Bu yüzden servis torbasına eklenmez, buradan geçirilir.
   * Verilmezse sayaçlar sürecin içinde tutulur.
   */
  readonly redisClient?: RateLimitRedisClient | null;
  /** Testler sınırları kapatır; açık bırakılırsa testler birbirini sınıra takar. */
  readonly rateLimits?: boolean;
}

/**
 * JSON API. Statik dosyaları web (nginx) konteyneri sunar ve /api ile /oauth
 * isteklerini buraya yönlendirir.
 *
 * Express 5 kullanılıyor: async rota fonksiyonlarındaki hatalar kendiliğinden
 * errorHandler'a iletilir, her rotayı try/catch ile sarmak gerekmez.
 */
export function createApp({
  commands,
  queries,
  services,
  config,
  redisClient = null,
  rateLimits = true
}: CreateAppOptions): Express {
  const app = express();
  const logger = services.logger as ChildLogger;

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

  const limiters = createRateLimiters({ enabled: rateLimits, redisClient });
  const json = express.json({ limit: "64kb" });
  const largeJson = express.json({ limit: "1mb" }); // yalnızca CSV ile toplu ürün
  const form = express.urlencoded({ extended: false, limit: "16kb" }); // OAuth jeton ucu

  const context: RouteContext = { commands, queries, services, config, limiters };

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
