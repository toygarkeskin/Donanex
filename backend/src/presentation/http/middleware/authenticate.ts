"use strict";

import type { Request, RequestHandler } from "express";

import { UnauthorizedError, ForbiddenError } from "../../../domain/shared/errors";
import { ResolveAccessPolicyQuery } from "../../../application/identity";
import { AccessPolicy, type AccessContext } from "../../../domain/identity/AccessPolicy";
import type { QueryBus } from "../../../application/shared/cqrs/bus";

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
export interface AuthenticateDeps {
  readonly tokenIssuer: {
    verifyAccessToken(token: unknown, options?: { audience?: string | null }): Promise<Record<string, any> | null>;
  };
  readonly queries: Pick<QueryBus, "ask">;
}

export function authenticate({ tokenIssuer, queries }: AuthenticateDeps): RequestHandler {
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

    const { policy, sessionVersion } = await queries.ask<{
      policy: AccessPolicy;
      /** Hesap kullanılamaz durumdaysa null. */
      sessionVersion: number | null;
    }>(new ResolveAccessPolicyQuery({ userId: payload.sub }));
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
export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.auth?.userId) return next(new UnauthorizedError("Bu işlem için giriş yapmalısınız."));
  next();
};

/**
 * İzin denetimi. scopeFrom, isteğe bakıp hangi mağaza kapsamında
 * sorulacağını söyler (ör. (req) => ({ storeId: req.params.storeId })).
 */
export function requirePermission(
  permission: string,
  scopeFrom: (req: Request) => AccessContext = () => ({})
): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth?.userId) return next(new UnauthorizedError("Bu işlem için giriş yapmalısınız."));
    if (!req.auth.policy.can(permission, scopeFrom(req))) {
      return next(new ForbiddenError("Bu işlem için yetkiniz yok."));
    }
    next();
  };
}

/** Jetonun istenen izin alanını (scope) taşıdığını denetler. */
export function requireScope(scope: string): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth?.scope?.includes(scope)) {
      return next(new ForbiddenError(`Bu uç "${scope}" izin alanını gerektirir.`));
    }
    next();
  };
}
