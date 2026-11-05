"use strict";

const { Router } = require("express");
const {
  AuthorizeCommand,
  ExchangeTokenCommand,
  RevokeTokenCommand,
  GetAuthorizationRequestQuery
} = require("../../../application/identity");
const { SUPPORTED_SCOPES, GrantTypes } = require("../../../domain/identity/OAuthClient");
const { GetCurrentUserQuery } = require("../../../application/identity");
const { COOKIES, buildCookie, appendCookie } = require("../support/cookies");
const { authPolicy } = require("../../../application/identity");

const { REFRESH_TOKEN_TTL_MS } = authPolicy;
const { requireAuth } = require("../middleware/authenticate");

/**
 * OAuth 2.1 / OpenID Connect uçları.
 *
 * Akış: tarayıcıdaki uygulama açık (public) istemcidir, bu yüzden istemci
 * parolası yoktur ve PKCE zorunludur. Yenileme jetonu JavaScript'in
 * okuyamayacağı HttpOnly çerezde taşınır.
 */

/** OAuth hataları RFC 6749'un istediği biçimde döner. */
function oauthError(res, status, error, description) {
  return res.status(status).json({ error, error_description: description });
}

function discovery({ config, services }) {
  const router = Router();
  const base = config.publicUrl;

  router.get("/openid-configuration", (_req, res) => {
    res.json({
      issuer: config.issuer,
      authorization_endpoint: `${base}/oauth/authorize`,
      token_endpoint: `${base}/oauth/token`,
      revocation_endpoint: `${base}/oauth/revoke`,
      userinfo_endpoint: `${base}/oauth/userinfo`,
      jwks_uri: `${base}/oauth/jwks`,
      response_types_supported: ["code"],
      grant_types_supported: Object.values(GrantTypes),
      scopes_supported: SUPPORTED_SCOPES,
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none", "client_secret_basic", "client_secret_post"],
      id_token_signing_alg_values_supported: ["RS256"],
      subject_types_supported: ["public"],
      claims_supported: ["sub", "iss", "aud", "exp", "iat", "email", "email_verified", "name"]
    });
  });

  // Bazı istemciler JWKS'i kök altında arar.
  router.get("/jwks.json", (_req, res) => res.json(services.tokenIssuer.jwks()));

  return router;
}

function endpoints({ commands, queries, services, config, limiters }) {
  const router = Router();

  router.get("/jwks", (_req, res) => {
    res.setHeader("Cache-Control", "public, max-age=300");
    res.json(services.tokenIssuer.jwks());
  });

  /**
   * Yetkilendirme adımı. Oturum varsa doğrudan kod üretilir; yoksa istek
   * saklanır ve kullanıcı arayüzün giriş sayfasına yönlendirilir.
   */
  router.get("/authorize", async (req, res) => {
    const result = await commands.execute(
      new AuthorizeCommand({ params: req.query, ssoToken: req.cookies[COOKIES.SSO] || null })
    );
    res.redirect(302, result.redirectTo);
  });

  /** Giriş sayfasının bekleyen isteği tanıması için. */
  router.get("/authorize/request/:id", async (req, res) => {
    res.json(await queries.ask(new GetAuthorizationRequestQuery({ authRequestId: req.params.id })));
  });

  /**
   * Jeton ucu. Yenileme jetonu hem çerezden hem gövdeden okunabilir:
   * tarayıcı çerezi kullanır, sunucu istemcileri gövdeyi.
   */
  router.post("/token", limiters.token, async (req, res, next) => {
    const params = { ...req.body };
    if (params.grant_type === GrantTypes.REFRESH_TOKEN && !params.refresh_token) {
      params.refresh_token = req.cookies[COOKIES.REFRESH];
    }

    try {
      const tokens = await commands.execute(
        new ExchangeTokenCommand({ params, clientCredentials: readBasicAuth(req) }),
        { ip: req.ip, userAgent: req.get("user-agent") }
      );

      // Yenileme jetonu tarayıcıya çerezle verilir; gövdede dönmez.
      if (tokens.refresh_token) {
        appendCookie(
          res,
          buildCookie(COOKIES.REFRESH, tokens.refresh_token, {
            maxAgeSeconds: REFRESH_TOKEN_TTL_MS / 1000,
            secure: config.cookieSecure,
            sameSite: "Strict"
          })
        );
        delete tokens.refresh_token;
      }
      res.json(tokens);
    } catch (error) {
      // OAuth uçları hata biçimini spesifikasyona göre döndürür.
      if (error.name === "ValidationError") return oauthError(res, 400, "invalid_request", error.message);
      if (error.name === "UnauthorizedError") return oauthError(res, 401, "invalid_grant", error.message);
      if (error.name === "ForbiddenError") return oauthError(res, 403, "access_denied", error.message);
      return next(error);
    }
  });

  /** RFC 7009: geçersiz jeton için de başarı döner. */
  router.post("/revoke", async (req, res) => {
    const token = req.body?.token || req.cookies[COOKIES.REFRESH];
    await commands.execute(new RevokeTokenCommand({ token }));
    res.status(200).json({ revoked: true });
  });

  /** OIDC kullanıcı bilgisi ucu. */
  router.get("/userinfo", requireAuth, async (req, res) => {
    const user = await queries.ask(
      new GetCurrentUserQuery({ userId: req.auth.userId }),
      { policy: req.auth.policy }
    );
    res.json({
      sub: req.auth.userId,
      name: user?.fullName,
      email: user?.email,
      email_verified: user?.emailVerified
    });
  });

  return router;
}

/** Authorization: Basic <base64(clientId:secret)> */
function readBasicAuth(req) {
  const header = req.get("authorization");
  if (!header || !header.startsWith("Basic ")) return null;
  try {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    const separator = decoded.indexOf(":");
    if (separator < 0) return null;
    return {
      clientId: decodeURIComponent(decoded.slice(0, separator)),
      clientSecret: decodeURIComponent(decoded.slice(separator + 1))
    };
  } catch {
    return null;
  }
}

module.exports = { oauthRoutes: { discovery, endpoints } };
