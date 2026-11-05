"use strict";

const { SSO_SESSION_TTL_MS } = require("../authPolicy");

/**
 * Tarayıcı için tekil oturum (SSO) açar. Bu oturum jeton DEĞİLDİR:
 * yalnızca /oauth/authorize adımında "bu kişi zaten giriş yapmış" demeye yarar,
 * böylece erişim jetonu yenilenirken tekrar parola sorulmaz.
 *
 * Çerezde kodun açık hali, veritabanında yalnızca özeti durur.
 */
async function issueSsoSession({ authSessions }, { userId, opaqueTokens, clock, context = {} }) {
  const token = opaqueTokens.generate();
  const expiresAt = new Date(clock.now().getTime() + SSO_SESSION_TTL_MS);

  const session = await authSessions.create({
    userId,
    tokenHash: opaqueTokens.hash(token),
    expiresAt,
    ip: context.ip ?? null,
    userAgent: context.userAgent ?? null
  });

  return { token, sessionId: session.id, expiresAt, maxAgeSeconds: Math.floor(SSO_SESSION_TTL_MS / 1000) };
}

module.exports = { issueSsoSession };
