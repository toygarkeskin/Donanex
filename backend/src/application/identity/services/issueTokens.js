"use strict";

const { ACCESS_TOKEN_TTL_MS, REFRESH_TOKEN_TTL_MS, ID_TOKEN_TTL_MS } = require("../authPolicy");

/**
 * Erişim + yenileme (+ istenirse kimlik) jetonlarını birlikte üretir.
 *
 * Yenileme jetonu "aile" (family) kimliğiyle saklanır: bir jeton ikinci kez
 * kullanılmaya çalışılırsa tüm aile iptal edilir. Böylece çalınan bir yenileme
 * jetonu en fazla bir kez işe yarar ve hırsızlık fark edilir.
 */
async function issueTokenSet(
  { oauth },
  { user, policy, client, scope, sessionId, familyId = null, services, nonce = null }
) {
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

  const tokens = {
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

module.exports = { issueTokenSet };
