"use strict";

import { SSO_SESSION_TTL_MS } from "../authPolicy";
import type { AuthSessionRepository, Clock, OpaqueTokens } from "../../shared/contracts";

export interface IssuedSsoSession {
  readonly token: string;
  readonly sessionId: string;
  readonly expiresAt: Date;
  readonly maxAgeSeconds: number;
}

/**
 * Tarayıcı için tekil oturum (SSO) açar. Bu oturum jeton DEĞİLDİR:
 * yalnızca /oauth/authorize adımında "bu kişi zaten giriş yapmış" demeye yarar,
 * böylece erişim jetonu yenilenirken tekrar parola sorulmaz.
 *
 * Çerezde kodun açık hali, veritabanında yalnızca özeti durur.
 */
export async function issueSsoSession(
  { authSessions }: { authSessions: AuthSessionRepository },
  {
    userId,
    opaqueTokens,
    clock,
    context = {}
  }: {
    userId: string;
    opaqueTokens: OpaqueTokens;
    clock: Clock;
    // İstek bağlamının tamamı geçilir; yalnızca ip ve userAgent okunur.
    context?: { ip?: unknown; userAgent?: unknown; [key: string]: unknown };
  }
): Promise<IssuedSsoSession> {
  const token = opaqueTokens.generate();
  const expiresAt = new Date(clock.now().getTime() + SSO_SESSION_TTL_MS);

  const session = await authSessions.create({
    userId,
    tokenHash: opaqueTokens.hash(token),
    expiresAt,
    ip: (context.ip as string | null) ?? null,
    userAgent: (context.userAgent as string | null) ?? null
  });

  return { token, sessionId: session.id, expiresAt, maxAgeSeconds: Math.floor(SSO_SESSION_TTL_MS / 1000) };
}
