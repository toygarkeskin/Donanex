"use strict";

import crypto from "node:crypto";
import type { Pkce as PkcePort } from "../../application/shared/contracts";

/**
 * PKCE (RFC 7636) S256 doğrulaması.
 *
 * Açık istemcide (tarayıcıdaki tek sayfa uygulaması) istemci parolası
 * saklanamaz. PKCE bunun yerine her girişte üretilen tek kullanımlık bir sır
 * kullanır: yetkilendirme kodu çalınsa bile, doğrulayıcıyı bilmeyen saldırgan
 * kodu jetona çeviremez.
 */
export class Pkce implements PkcePort {
  challengeFor(verifier: string): string {
    return crypto.createHash("sha256").update(verifier).digest("base64url");
  }

  verify(verifier: unknown, challenge: unknown): boolean {
    if (typeof verifier !== "string" || typeof challenge !== "string") return false;
    const expected = Buffer.from(this.challengeFor(verifier));
    const presented = Buffer.from(challenge);
    // Uzunluk eşitliği önce denetlenir: timingSafeEqual farklı uzunlukta atar.
    return expected.length === presented.length && crypto.timingSafeEqual(expected, presented);
  }
}
