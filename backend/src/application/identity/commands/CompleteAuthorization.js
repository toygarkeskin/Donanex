"use strict";

const { Command } = require("../../shared/cqrs/Message");
const { ValidationError } = require("../../../domain/shared/errors");
const { AUTHORIZATION_CODE_TTL_MS } = require("../authPolicy");

class CompleteAuthorizationCommand extends Command {
  /** @param {{authRequestId:string, userId:string, sessionId:string}} input */
  constructor(input) {
    super();
    this.authRequestId = input?.authRequestId;
    this.userId = input?.userId;
    this.sessionId = input?.sessionId;
  }
}

/**
 * Giriş tamamlandıktan sonra bekleyen /oauth/authorize isteğini bitirir:
 * yetkilendirme kodunu üretir ve istemcinin adresine dönecek bağlantıyı verir.
 * İstek tek kullanımlıktır; kullanıldıktan sonra önbellekten silinir.
 */
class CompleteAuthorizationHandler {
  constructor({ unitOfWork, opaqueTokens, cache, clock }) {
    this.unitOfWork = unitOfWork;
    this.opaqueTokens = opaqueTokens;
    this.cache = cache;
    this.clock = clock;
  }

  async handle({ authRequestId, userId, sessionId }) {
    const key = `authreq:${authRequestId}`;
    const request = await this.cache.get(key);
    if (!request) throw new ValidationError("Giriş isteğinin süresi dolmuş. Lütfen baştan deneyin.");
    await this.cache.delete(key);

    const code = this.opaqueTokens.generate();
    await this.unitOfWork.run(({ oauth }) =>
      oauth.saveAuthorizationCode({
        codeHash: this.opaqueTokens.hash(code),
        clientId: request.clientId,
        userId,
        sessionId,
        redirectUri: request.redirectUri,
        scope: request.scope,
        nonce: request.nonce,
        codeChallenge: request.codeChallenge,
        expiresAt: new Date(this.clock.now().getTime() + AUTHORIZATION_CODE_TTL_MS)
      })
    );

    const url = new URL(request.redirectUri);
    url.searchParams.set("code", code);
    if (request.state) url.searchParams.set("state", request.state);
    return { redirectTo: url.toString() };
  }
}

module.exports = { CompleteAuthorizationCommand, CompleteAuthorizationHandler };
