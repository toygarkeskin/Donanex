"use strict";

import { EventTypes, domainEvent } from "../../../domain/shared/DomainEvent";
import { mergeGuestCart } from "./mergeGuestCart";
import { issueSsoSession, type IssuedSsoSession } from "./issueSession";
import { LOGIN_CODE_LENGTH, LOGIN_CODE_TTL_MS } from "../authPolicy";
import type { Clock, OpaqueTokens, Repositories } from "../../shared/contracts";

/*
 * Girişin iki adımı arasında paylaşılan parçalar.
 *
 * SignIn (parola) ile VerifySignInCode (kod) aynı yerde biter: oturum açılır,
 * misafir sepeti taşınır, giriş kaydedilir. Bu "bitiş" tek fonksiyonda; iki
 * komut ayrı ayrı yazsa biri sepet taşımayı unuttuğunda fark edilmezdi.
 */

export interface SignedIn {
  readonly user: { id: string; email: string; fullName: string };
  readonly session: IssuedSsoSession;
  readonly mergedCartItems: number;
}

/** Kodun özetine kodun kimliği karışıyor: aynı 6 hane başka bir girişte başka özet verir. */
export const loginCodeHash = (opaqueTokens: OpaqueTokens, challengeId: string, code: string): string =>
  opaqueTokens.hash(`giris-kodu:${challengeId}:${code}`);

/**
 * Yeni kod üretir, özetini yazar ve e-postayı outbox'a koyar. Açık kod
 * yalnızca olayın içinde e-posta tüketicisine gider (parola sıfırlama
 * bağlantısı da böyle taşınıyor); yanıtta dönmez.
 */
export async function sendLoginCode(
  repos: Repositories,
  {
    challengeId,
    user,
    opaqueTokens,
    clock,
    resend = false
  }: {
    challengeId: string;
    user: { id: string; email: string; fullName: string };
    opaqueTokens: OpaqueTokens;
    clock: Clock;
    resend?: boolean;
  }
): Promise<void> {
  const code = opaqueTokens.numericCode(LOGIN_CODE_LENGTH);
  const now = clock.now();
  const expiresAt = new Date(now.getTime() + LOGIN_CODE_TTL_MS);
  const codeHash = loginCodeHash(opaqueTokens, challengeId, code);

  if (resend) await repos.loginChallenges.resend({ id: challengeId, codeHash, expiresAt, now });
  else await repos.loginChallenges.create({ id: challengeId, userId: user.id, codeHash, expiresAt });

  await repos.outbox.add(
    domainEvent(EventTypes.USER_LOGIN_CODE_REQUESTED, "user", user.id, {
      email: user.email,
      fullName: user.fullName,
      code,
      expiresInMinutes: Math.round(LOGIN_CODE_TTL_MS / 60_000)
    })
  );
}

/** "a***@ornek.com": kodun nereye gittiğini söyler, adresi ele vermez. */
export function maskEmail(email: string): string {
  const [local = "", domain = ""] = email.split("@");
  const shown = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2);
  return `${shown}${"*".repeat(Math.max(3, local.length - shown.length))}@${domain}`;
}

/** Kimlik doğrulandıktan sonraki ortak bitiş: oturum, sepet, kayıt. */
export async function finishSignIn(
  repos: Repositories,
  {
    user,
    guestCartId,
    opaqueTokens,
    clock,
    context,
    method
  }: {
    user: { id: string; email: string; fullName: string };
    guestCartId: string | null;
    opaqueTokens: OpaqueTokens;
    clock: Clock;
    context: { ip?: unknown; userAgent?: unknown; [key: string]: unknown };
    method: "kod" | "guvenilen_cihaz";
  }
): Promise<SignedIn> {
  const cart = await mergeGuestCart(repos, { guestCartId, userId: user.id });
  const session = await issueSsoSession(repos, { userId: user.id, opaqueTokens, clock, context });
  await repos.users.touchLastLogin(user.id);
  await repos.audit.record({
    actorId: user.id,
    action: "user.signed_in",
    resourceType: "user",
    resourceId: user.id,
    metadata: { yontem: method },
    context
  });

  return {
    user: { id: user.id, email: user.email, fullName: user.fullName },
    session,
    mergedCartItems: cart.merged
  };
}

