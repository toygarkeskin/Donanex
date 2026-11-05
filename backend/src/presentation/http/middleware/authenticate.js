"use strict";

const { UnauthorizedError, ForbiddenError } = require("../../../domain/shared/errors");
const { ResolveAccessPolicyQuery } = require("../../../application/identity");
const { AccessPolicy } = require("../../../domain/identity/AccessPolicy");

/**
 * Bearer erişim jetonunu çözer. Jeton yoksa istek "misafir" olarak devam eder;
 * koruma gereken rotalar requireAuth / requirePermission kullanır.
 *
 * Her istekte üç şey denetlenir:
 *   1. İmza ve süre          (jetonun kendisi)
 *   2. Oturum sürümü         (parola değiştiyse eski jetonlar düşer)
 *   3. Güncel yetkiler       (rol alındıysa anında etkisiz kalır)
 *
 * İzinlerin jetona gömülmemesinin bedeli bu küçük denetimdir; karşılığında
 * yetki değişiklikleri jeton süresini beklemeden geçerli olur.
 */
function authenticate({ tokenIssuer, queries }) {
  return async (req, _res, next) => {
    req.auth = null;

    const header = req.get("authorization");
    if (!header || !header.startsWith("Bearer ")) return next();

    const payload = await tokenIssuer.verifyAccessToken(header.slice(7).trim());
    if (!payload) return next(new UnauthorizedError("Oturumunuzun süresi dolmuş. Lütfen yeniden giriş yapın."));

    // Makineden makineye jetonlar (client_credentials) kullanıcıya bağlı değildir.
    if (String(payload.sub).startsWith("client:")) {
      req.auth = {
        clientId: payload.aud,
        userId: null,
        scope: String(payload.scope || "").split(" "),
        policy: AccessPolicy.empty(),
        isMachine: true
      };
      return next();
    }

    const { policy, sessionVersion } = await queries.ask(new ResolveAccessPolicyQuery({ userId: payload.sub }));
    if (sessionVersion === null) {
      return next(new ForbiddenError("Hesabınız kullanılamıyor."));
    }
    if (sessionVersion !== payload.sv) {
      return next(new UnauthorizedError("Oturumunuz sonlandırılmış. Lütfen yeniden giriş yapın."));
    }

    req.auth = {
      userId: payload.sub,
      sessionId: payload.sid,
      clientId: payload.aud,
      scope: String(payload.scope || "").split(" "),
      policy,
      isMachine: false
    };
    next();
  };
}

/** Giriş yapılmış olmasını ister. */
function requireAuth(req, _res, next) {
  if (!req.auth?.userId) return next(new UnauthorizedError("Bu işlem için giriş yapmalısınız."));
  next();
}

/**
 * İzin denetimi. scopeFrom, isteğe bakıp hangi mağaza kapsamında
 * sorulacağını söyler (ör. (req) => ({ storeId: req.params.storeId })).
 */
function requirePermission(permission, scopeFrom = () => ({})) {
  return (req, _res, next) => {
    if (!req.auth?.userId) return next(new UnauthorizedError("Bu işlem için giriş yapmalısınız."));
    if (!req.auth.policy.can(permission, scopeFrom(req))) {
      return next(new ForbiddenError("Bu işlem için yetkiniz yok."));
    }
    next();
  };
}

/** Jetonun istenen izin alanını (scope) taşıdığını denetler. */
function requireScope(scope) {
  return (req, _res, next) => {
    if (!req.auth?.scope?.includes(scope)) {
      return next(new ForbiddenError(`Bu uç "${scope}" izin alanını gerektirir.`));
    }
    next();
  };
}

module.exports = { authenticate, requireAuth, requirePermission, requireScope };
