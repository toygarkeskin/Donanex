"use strict";

const crypto = require("crypto");

/**
 * PKCE (RFC 7636) S256 doğrulaması.
 *
 * Açık istemcide (tarayıcıdaki tek sayfa uygulaması) istemci parolası
 * saklanamaz. PKCE bunun yerine her girişte üretilen tek kullanımlık bir sır
 * kullanır: yetkilendirme kodu çalınsa bile, doğrulayıcıyı bilmeyen saldırgan
 * kodu jetona çeviremez.
 */
class Pkce {
  challengeFor(verifier) {
    return crypto.createHash("sha256").update(verifier).digest("base64url");
  }

  verify(verifier, challenge) {
    if (typeof verifier !== "string" || typeof challenge !== "string") return false;
    const expected = Buffer.from(this.challengeFor(verifier));
    const presented = Buffer.from(challenge);
    return expected.length === presented.length && crypto.timingSafeEqual(expected, presented);
  }
}

module.exports = { Pkce };
