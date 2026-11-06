"use strict";

import { Command, type Handler } from "../../shared/cqrs/Message";
import { ValidationError } from "../../../domain/shared/errors";
import { AUTHORIZATION_CODE_TTL_MS } from "../authPolicy";
import type { PendingAuthRequest } from "./Authorize";
import type { Cache, Clock, OpaqueTokens, UnitOfWork } from "../../shared/contracts";

export class CompleteAuthorizationCommand extends Command {
  readonly authRequestId: string;
  readonly userId: string;
  readonly sessionId: string;

  constructor(input?: { authRequestId?: string; userId?: string; sessionId?: string }) {
    super();
    this.authRequestId = input?.authRequestId as string;
    this.userId = input?.userId as string;
    this.sessionId = input?.sessionId as string;
  }
}

export interface AuthorizationCompleted {
  readonly redirectTo: string;
}

/**
 * Giriş tamamlandıktan sonra bekleyen /oauth/authorize isteğini bitirir:
 * yetkilendirme kodunu üretir ve istemcinin adresine dönecek bağlantıyı verir.
 * İstek tek kullanımlıktır; kullanıldıktan sonra önbellekten silinir.
 */
export class CompleteAuthorizationHandler
  implements Handler<CompleteAuthorizationCommand, AuthorizationCompleted>
{
  private readonly unitOfWork: UnitOfWork;
  private readonly opaqueTokens: OpaqueTokens;
  private readonly cache: Cache;
  private readonly clock: Clock;

  constructor({
    unitOfWork,
    opaqueTokens,
    cache,
    clock
  }: {
    unitOfWork: UnitOfWork;
    opaqueTokens: OpaqueTokens;
    cache: Cache;
    clock: Clock;
  }) {
    this.unitOfWork = unitOfWork;
    this.opaqueTokens = opaqueTokens;
    this.cache = cache;
    this.clock = clock;
  }

  async handle({
    authRequestId,
    userId,
    sessionId
  }: CompleteAuthorizationCommand): Promise<AuthorizationCompleted> {
    const key = `authreq:${authRequestId}`;
    const request = await this.cache.get<PendingAuthRequest>(key);
    if (!request) throw new ValidationError("Giriş isteğinin süresi dolmuş. Lütfen baştan deneyin.");
    // Tek kullanımlık: aynı istekle ikinci bir kod üretilemez.
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
