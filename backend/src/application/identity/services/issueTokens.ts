"use strict";

import { ACCESS_TOKEN_TTL_MS, REFRESH_TOKEN_TTL_MS, ID_TOKEN_TTL_MS } from "../authPolicy";
import type { AccessPolicy } from "../../../domain/identity/AccessPolicy";
import type { OAuthClient } from "../../../domain/identity/OAuthClient";
import type { Clock, IdGenerator, OAuthRepository, OpaqueTokens, Row, TokenIssuer } from "../../shared/contracts";

/** Jeton üretimi için gereken servisler. */
export interface TokenServices {
  readonly tokenIssuer: TokenIssuer;
  readonly opaqueTokens: OpaqueTokens;
  readonly clock: Clock;
  readonly ids: IdGenerator;
}

/** OAuth 2.1 jeton yanıtı (RFC 6749 biçimi). */
export interface TokenSet {
  access_token: unknown;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
  refresh_expires_in: number;
  scope: string;
  id_token?: unknown;
}

/**
 * Erişim + yenileme (+ istenirse kimlik) jetonlarını birlikte üretir.
 *
 * Yenileme jetonu "aile" (family) kimliğiyle saklanır: bir jeton ikinci kez
 * kullanılmaya çalışılırsa tüm aile iptal edilir. Böylece çalınan bir yenileme
 * jetonu en fazla bir kez işe yarar ve hırsızlık fark edilir.
 */
export async function issueTokenSet(
  { oauth }: { oauth: OAuthRepository },
  {
    user,
    policy,
    client,
    scope,
    sessionId,
    familyId = null,
    services,
    nonce = null
  }: {
    user: Row;
    policy: AccessPolicy;
    client: OAuthClient;
    scope: string;
    sessionId: string;
    familyId?: string | null;
    services: TokenServices;
    nonce?: string | null;
  }
): Promise<TokenSet> {
  const { tokenIssuer, opaqueTokens, clock, ids } = services;
  const now = clock.now();

  const accessToken = await tokenIssuer.issueAccessToken({
    subject: user.id,
    audience: client.clientId,
    scope,
    sessionId,
    roles: policy.toClaims(),
    sessionVersion: user.sessionVersion,
    expiresAt: new Date(now.getTime() + ACCESS_TOKEN_TTL_MS)
  });

  const refreshToken = opaqueTokens.generate();
  await oauth.saveRefreshToken({
    id: ids.uuid(),
    familyId: familyId ?? ids.uuid(),
    userId: user.id,
    clientId: client.clientId,
    sessionId,
    scope,
    tokenHash: opaqueTokens.hash(refreshToken),
    expiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_MS)
  });

  const tokens: TokenSet = {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: Math.floor(ACCESS_TOKEN_TTL_MS / 1000),
    refresh_token: refreshToken,
    refresh_expires_in: Math.floor(REFRESH_TOKEN_TTL_MS / 1000),
    scope
  };

  if (scope.split(" ").includes("openid")) {
    tokens.id_token = await tokenIssuer.issueIdToken({
      subject: user.id,
      audience: client.clientId,
      nonce,
      email: user.email,
      emailVerified: user.emailVerified,
      name: user.fullName,
      authTime: now,
      expiresAt: new Date(now.getTime() + ID_TOKEN_TTL_MS)
    });
  }

  return tokens;
}
