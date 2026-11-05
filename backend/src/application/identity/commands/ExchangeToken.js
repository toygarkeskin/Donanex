"use strict";

const { Command } = require("../../shared/cqrs/Message");
const { ValidationError, UnauthorizedError, ForbiddenError } = require("../../../domain/shared/errors");
const { AccessPolicy } = require("../../../domain/identity/AccessPolicy");
const { UserStatus } = require("../../../domain/identity/User");
const { GrantTypes, assertGrantAllowed } = require("../../../domain/identity/OAuthClient");
const { ACCESS_TOKEN_TTL_MS } = require("../authPolicy");
const { issueTokenSet } = require("../services/issueTokens");

class ExchangeTokenCommand extends Command {
  /** @param {{params:object, clientCredentials:{clientId,clientSecret}|null}} input */
  constructor(input) {
    super();
    this.params = input?.params || {};
    this.clientCredentials = input?.clientCredentials ?? null;
  }
}

/**
 * OAuth 2.1 jeton ucu (/oauth/token). Üç akış destekler:
 *
 *   authorization_code — PKCE doğrulamasıyla, tek kullanımlık kod karşılığı
 *   refresh_token      — döndürmeli (rotating) yenileme + tekrar kullanım tespiti
 *   client_credentials — kullanıcı olmadan, makineden makineye
 *
 * DİKKAT — transaction sınırları burada güvenliğin parçasıdır:
 * "kodu tüket" ve "jeton ailesini iptal et" adımları KENDİ transaction'larında
 * yapılır. Aynı transaction içinde yapılıp sonra hata fırlatılsaydı, geri alma
 * bu güvenlik etkilerini de siler ve saldırgan aynı kodu/jetonu tekrar
 * deneyebilirdi.
 */
class ExchangeTokenHandler {
  constructor(services) {
    this.services = services;
    this.unitOfWork = services.unitOfWork;
    this.opaqueTokens = services.opaqueTokens;
    this.pkce = services.pkce;
    this.passwordHasher = services.passwordHasher;
    this.tokenIssuer = services.tokenIssuer;
    this.clock = services.clock;
  }

  async handle({ params, clientCredentials }, context = {}) {
    const client = await this.authenticateClient(params, clientCredentials);

    switch (params.grant_type) {
      case GrantTypes.AUTHORIZATION_CODE:
        return this.byAuthorizationCode(client, params, context);
      case GrantTypes.REFRESH_TOKEN:
        return this.byRefreshToken(client, params, context);
      case GrantTypes.CLIENT_CREDENTIALS:
        return this.byClientCredentials(client, params);
      default:
        throw new ValidationError("Desteklenmeyen grant_type.");
    }
  }

  /** Gizli (confidential) istemci parolasını kanıtlar; açık istemci PKCE ile korunur. */
  async authenticateClient(params, credentials) {
    const clientId = credentials?.clientId || params.client_id;
    if (!clientId) throw new ValidationError("client_id zorunludur.");

    const client = await this.unitOfWork.run(({ oauth }) => oauth.findClient(clientId));
    if (!client) throw new UnauthorizedError("İstemci doğrulanamadı.");

    if (client.isConfidential) {
      const secret = credentials?.clientSecret || params.client_secret;
      const ok = typeof secret === "string" && (await this.passwordHasher.verify(secret, client.secretHash));
      if (!ok) throw new UnauthorizedError("İstemci doğrulanamadı.");
    }
    return client;
  }

  async byAuthorizationCode(client, params, context) {
    assertGrantAllowed(client, GrantTypes.AUTHORIZATION_CODE);
    const { code, code_verifier: verifier, redirect_uri: redirectUri } = params;

    if (!this.opaqueTokens.isWellFormed(code)) throw new ValidationError("Yetkilendirme kodu geçersiz.");
    if (typeof verifier !== "string" || verifier.length < 43 || verifier.length > 128) {
      throw new ValidationError("code_verifier geçersiz.");
    }

    // 1) Kod kendi transaction'ında tüketilir ve hemen kalıcı olur.
    //    Böylece doğrulama başarısız olsa bile kod "yanmış" sayılır.
    const saved = await this.unitOfWork.run(({ oauth }) =>
      oauth.consumeAuthorizationCode(this.opaqueTokens.hash(code), this.clock.now())
    );
    if (!saved) throw new ValidationError("Yetkilendirme kodu geçersiz veya süresi dolmuş.");

    // 2) Kod tüketildikten sonra doğrulanır.
    if (saved.clientId !== client.clientId) throw new ValidationError("Kod bu istemciye ait değil.");
    if (saved.redirectUri !== redirectUri) throw new ValidationError("redirect_uri eşleşmiyor.");
    if (!this.pkce.verify(verifier, saved.codeChallenge)) {
      throw new ValidationError("PKCE doğrulaması başarısız.");
    }

    // 3) Jetonlar ayrı bir transaction'da üretilir.
    return this.unitOfWork.run(async (repos) => {
      const { user, policy } = await this.loadActor(repos, saved.userId);
      const tokens = await issueTokenSet(repos, {
        user,
        policy,
        client,
        scope: saved.scope,
        sessionId: saved.sessionId,
        nonce: saved.nonce,
        services: this.services
      });

      await repos.audit.record({
        actorId: user.id,
        action: "oauth.token_issued",
        resourceType: "oauth_client",
        resourceId: client.clientId,
        context
      });
      return tokens;
    });
  }

  async byRefreshToken(client, params, context) {
    assertGrantAllowed(client, GrantTypes.REFRESH_TOKEN);
    const presented = params.refresh_token;
    if (!this.opaqueTokens.isWellFormed(presented)) {
      throw new UnauthorizedError("Yenileme jetonu geçersiz.");
    }

    const stored = await this.unitOfWork.run(({ oauth }) =>
      oauth.findRefreshTokenByHash(this.opaqueTokens.hash(presented))
    );
    if (!stored || stored.clientId !== client.clientId) {
      throw new UnauthorizedError("Yenileme jetonu geçersiz.");
    }

    // Tekrar kullanım tespiti: bu jeton daha önce harcanmışsa çalınmış demektir.
    // İptal kendi transaction'ında kalıcı yapılır, hata SONRA fırlatılır.
    if (stored.usedAt || stored.revokedAt) {
      await this.unitOfWork.run(async (repos) => {
        await repos.oauth.revokeRefreshTokenFamily(stored.familyId);
        await repos.authSessions.revoke(stored.sessionId);
        await repos.audit.record({
          actorId: stored.userId,
          action: "oauth.refresh_token_reuse_detected",
          resourceType: "oauth_client",
          resourceId: client.clientId,
          context
        });
      });
      throw new UnauthorizedError("Yenileme jetonu daha önce kullanılmış. Lütfen yeniden giriş yapın.");
    }

    if (stored.expiresAt <= this.clock.now()) {
      throw new UnauthorizedError("Yenileme jetonunun süresi dolmuş.");
    }

    return this.unitOfWork.run(async (repos) => {
      const session = await repos.authSessions.findActiveById(stored.sessionId, this.clock.now());
      if (!session) throw new UnauthorizedError("Oturum sonlandırılmış. Lütfen yeniden giriş yapın.");

      const { user, policy } = await this.loadActor(repos, stored.userId);
      await repos.oauth.markRefreshTokenUsed(stored.id, this.clock.now());

      return issueTokenSet(repos, {
        user,
        policy,
        client,
        scope: stored.scope,
        sessionId: stored.sessionId,
        familyId: stored.familyId,
        services: this.services
      });
    });
  }

  async byClientCredentials(client, params) {
    assertGrantAllowed(client, GrantTypes.CLIENT_CREDENTIALS);
    if (!client.isConfidential) {
      throw new ValidationError("client_credentials yalnızca gizli istemciler içindir.");
    }

    const scope = (params.scope || client.scopes.join(" "))
      .split(/\s+/)
      .filter((value) => client.scopes.includes(value))
      .join(" ");

    const accessToken = await this.tokenIssuer.issueAccessToken({
      subject: `client:${client.clientId}`,
      audience: client.clientId,
      scope,
      sessionId: null,
      roles: [],
      sessionVersion: 0,
      expiresAt: new Date(this.clock.now().getTime() + ACCESS_TOKEN_TTL_MS)
    });

    return {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: Math.floor(ACCESS_TOKEN_TTL_MS / 1000),
      scope
    };
  }

  async loadActor(repos, userId) {
    const user = await repos.users.findById(userId);
    if (!user) throw new UnauthorizedError("Kullanıcı bulunamadı.");
    if (user.status === UserStatus.SUSPENDED) throw new ForbiddenError("Hesap askıya alınmış.");

    const assignments = await repos.roles.listForUser(userId);
    return { user, policy: new AccessPolicy(assignments) };
  }
}

module.exports = { ExchangeTokenCommand, ExchangeTokenHandler };
