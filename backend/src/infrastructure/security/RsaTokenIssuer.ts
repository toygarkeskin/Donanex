"use strict";

import crypto, { type KeyObject, type webcrypto } from "node:crypto";

import type { Clock, Row, TokenIssuer } from "../../application/shared/contracts";

/** JWKS'te yayınlanan açık anahtarın şekli (Node'un webcrypto tipi). */
type PublicJwk = webcrypto.JsonWebKey;

/**
 * RS256 imzalı JWT üretir ve doğrular.
 *
 * Asimetrik imza seçilmesinin nedeni: jetonu YALNIZCA bu servis üretebilir,
 * ama açık anahtarla (JWKS) herkes doğrulayabilir. Başka bir servis eklendiğinde
 * ona gizli anahtar dağıtmak gerekmez.
 *
 * Node'un kendi crypto modülü kullanılır; üçüncü taraf JWT kütüphanesi yoktur.
 */
const b64url = (input: string | Buffer): string => Buffer.from(input).toString("base64url");
const unb64url = (input: string): Buffer => Buffer.from(input, "base64url");

export interface RsaTokenIssuerOptions {
  readonly privateKeyPem: string;
  readonly publicKeyPem: string;
  readonly issuer: string;
  readonly clock?: Clock;
}

export class RsaTokenIssuer implements TokenIssuer {
  private readonly privateKey: KeyObject;
  private readonly publicKey: KeyObject;
  private readonly issuer: string;
  private readonly clock: Clock;
  private readonly jwk: PublicJwk;
  private readonly kid: string;

  constructor({ privateKeyPem, publicKeyPem, issuer, clock = { now: () => new Date() } }: RsaTokenIssuerOptions) {
    this.privateKey = crypto.createPrivateKey(privateKeyPem);
    this.publicKey = crypto.createPublicKey(publicKeyPem);
    this.issuer = issuer;
    this.clock = clock;

    if (this.privateKey.asymmetricKeyType !== "rsa") {
      throw new Error("JWT anahtarı RSA olmalı.");
    }
    if ((this.privateKey.asymmetricKeyDetails?.modulusLength ?? 0) < 2048) {
      throw new Error("JWT anahtarı en az 2048 bit olmalı.");
    }

    this.jwk = this.publicKey.export({ format: "jwk" });
    this.kid = RsaTokenIssuer.thumbprint(this.jwk);
  }

  /** RFC 7638 JWK parmak izi: anahtar döndürüldüğünde kid de değişir. */
  static thumbprint(jwk: PublicJwk): string {
    const canonical = JSON.stringify({ e: jwk.e, kty: jwk.kty, n: jwk.n });
    return crypto.createHash("sha256").update(canonical).digest("base64url");
  }

  private sign(payload: Row): string {
    const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT", kid: this.kid }));
    const body = b64url(JSON.stringify(payload));
    const signature = crypto.sign("sha256", Buffer.from(`${header}.${body}`), this.privateKey);
    return `${header}.${body}.${signature.toString("base64url")}`;
  }

  private seconds(date: Date): number {
    return Math.floor(date.getTime() / 1000);
  }

  async issueAccessToken({
    subject,
    audience,
    scope,
    sessionId,
    roles,
    sessionVersion,
    expiresAt
  }: Row): Promise<string> {
    const now = this.clock.now();
    return this.sign({
      iss: this.issuer,
      sub: subject,
      aud: audience,
      iat: this.seconds(now),
      exp: this.seconds(expiresAt),
      jti: crypto.randomUUID(),
      scope,
      sid: sessionId,
      // İzinler jetona GÖMÜLMEZ; yalnızca roller taşınır. İzinler her istekte
      // sunucuda çözülür, böylece yetkisi alınan kullanıcı anında etkisizleşir.
      roles,
      sv: sessionVersion
    });
  }

  async issueIdToken({ subject, audience, nonce, email, emailVerified, name, authTime, expiresAt }: Row): Promise<string> {
    const now = this.clock.now();
    return this.sign({
      iss: this.issuer,
      sub: subject,
      aud: audience,
      iat: this.seconds(now),
      exp: this.seconds(expiresAt),
      auth_time: this.seconds(authTime),
      ...(nonce ? { nonce } : {}),
      email,
      email_verified: emailVerified,
      name
    });
  }

  /**
   * Jetonu doğrular. Geçersizse null döner.
   * İmza, süre, issuer ve (verilmişse) audience denetlenir.
   */
  async verifyAccessToken(
    token: unknown,
    { audience = null }: { audience?: string | null } = {}
  ): Promise<Row | null> {
    if (typeof token !== "string" || token.length > 8192) return null;

    const parts = token.split(".");
    if (parts.length !== 3) return null;

    try {
      const header = JSON.parse(unb64url(parts[0]!).toString("utf8"));
      // "alg: none" ve HMAC'e düşürme saldırılarına karşı algoritma sabitlenir.
      if (header.alg !== "RS256") return null;

      const signed = Buffer.from(`${parts[0]}.${parts[1]}`);
      if (!crypto.verify("sha256", signed, this.publicKey, unb64url(parts[2]!))) return null;

      const payload = JSON.parse(unb64url(parts[1]!).toString("utf8"));
      const nowSeconds = this.seconds(this.clock.now());

      if (payload.iss !== this.issuer) return null;
      if (typeof payload.exp !== "number" || payload.exp <= nowSeconds) return null;
      if (typeof payload.iat !== "number" || payload.iat > nowSeconds + 60) return null;
      if (audience && payload.aud !== audience) return null;

      return payload;
    } catch {
      return null;
    }
  }

  /** OIDC açık anahtar seti. */
  jwks(): Row {
    return {
      keys: [{ ...this.jwk, kid: this.kid, use: "sig", alg: "RS256" }]
    };
  }
}
