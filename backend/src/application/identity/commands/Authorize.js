"use strict";

const { Command } = require("../../shared/cqrs/Message");
const { ValidationError } = require("../../../domain/shared/errors");
const { GrantTypes, assertRedirectUri, assertGrantAllowed, resolveScope } = require("../../../domain/identity/OAuthClient");
const { AUTHORIZATION_CODE_TTL_MS } = require("../authPolicy");

class AuthorizeCommand extends Command {
  /** @param {{params:object, ssoToken:string|null}} input */
  constructor(input) {
    super();
    this.params = input?.params || {};
    this.ssoToken = input?.ssoToken ?? null;
  }
}

/**
 * OAuth 2.1 yetkilendirme adımı (/oauth/authorize).
 *
 *  - response_type yalnızca "code": örtük akış (implicit) desteklenmez.
 *  - PKCE (S256) ZORUNLUDUR; düz metin "plain" yöntemi kabul edilmez.
 *  - redirect_uri TAM eşleşmeyle doğrulanır, açık yönlendirme açığı kapalıdır.
 *
 * Tarayıcıda geçerli bir oturum varsa kod hemen üretilir (sessiz yenileme).
 * Yoksa istek saklanır ve kullanıcı arayüzün giriş sayfasına yönlendirilir;
 * giriş bitince SignIn aynı isteği tamamlar.
 */
class AuthorizeHandler {
  constructor({ unitOfWork, opaqueTokens, cache, clock, ids, publicUrl }) {
    this.unitOfWork = unitOfWork;
    this.opaqueTokens = opaqueTokens;
    this.cache = cache;
    this.clock = clock;
    this.ids = ids;
    this.publicUrl = publicUrl;
  }

  async handle({ params, ssoToken }) {
    const client = await this.unitOfWork.run(({ oauth }) => oauth.findClient(params.client_id));
    if (!client) throw new ValidationError("client_id tanınmıyor.");

    // redirect_uri doğrulanmadan ASLA o adrese yönlendirme yapılmaz.
    const redirectUri = assertRedirectUri(client, params.redirect_uri);
    assertGrantAllowed(client, GrantTypes.AUTHORIZATION_CODE);

    if (params.response_type !== "code") {
      throw new ValidationError("response_type yalnızca \"code\" olabilir.");
    }
    if (params.code_challenge_method !== "S256") {
      throw new ValidationError("code_challenge_method \"S256\" olmalıdır.");
    }
    if (typeof params.code_challenge !== "string" || params.code_challenge.length < 43) {
      throw new ValidationError("code_challenge zorunludur.");
    }

    const scope = resolveScope(client, params.scope);
    const request = {
      clientId: client.clientId,
      // İstemci adı burada saklanır: giriş sayfası bunu göstermek için
      // veritabanına gitmek zorunda kalmaz (sorgu tarafı yazma tarafına dokunmaz).
      clientName: client.name,
      redirectUri,
      scope,
      state: typeof params.state === "string" ? params.state.slice(0, 500) : null,
      nonce: typeof params.nonce === "string" ? params.nonce.slice(0, 500) : null,
      codeChallenge: params.code_challenge
    };

    const session = await this.resolveSession(ssoToken);
    if (session) {
      const code = await this.issueCode(request, session);
      return { outcome: "code", redirectTo: this.buildRedirect(redirectUri, { code, state: request.state }) };
    }

    // Giriş gerekiyor: isteği sakla ve arayüzün giriş sayfasına gönder.
    const requestId = this.ids.uuid();
    await this.cache.set(`authreq:${requestId}`, request, 15 * 60);
    return {
      outcome: "login_required",
      authRequestId: requestId,
      redirectTo: `${this.publicUrl}/giris?auth=${encodeURIComponent(requestId)}`
    };
  }

  async resolveSession(ssoToken) {
    if (!ssoToken || !this.opaqueTokens.isWellFormed(ssoToken)) return null;
    return this.unitOfWork.run(({ authSessions }) =>
      authSessions.findActiveByTokenHash(this.opaqueTokens.hash(ssoToken), this.clock.now())
    );
  }

  async issueCode(request, session) {
    const code = this.opaqueTokens.generate();
    await this.unitOfWork.run(({ oauth }) =>
      oauth.saveAuthorizationCode({
        codeHash: this.opaqueTokens.hash(code),
        clientId: request.clientId,
        userId: session.userId,
        sessionId: session.id,
        redirectUri: request.redirectUri,
        scope: request.scope,
        nonce: request.nonce,
        codeChallenge: request.codeChallenge,
        expiresAt: new Date(this.clock.now().getTime() + AUTHORIZATION_CODE_TTL_MS)
      })
    );
    return code;
  }

  buildRedirect(redirectUri, params) {
    const url = new URL(redirectUri);
    for (const [key, value] of Object.entries(params)) {
      if (value !== null && value !== undefined) url.searchParams.set(key, value);
    }
    return url.toString();
  }
}

module.exports = { AuthorizeCommand, AuthorizeHandler };
