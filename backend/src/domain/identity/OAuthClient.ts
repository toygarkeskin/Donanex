"use strict";

import { ValidationError } from "../shared/errors";

export const GrantTypes = {
  AUTHORIZATION_CODE: "authorization_code",
  REFRESH_TOKEN: "refresh_token",
  CLIENT_CREDENTIALS: "client_credentials"
} as const;

export type GrantType = (typeof GrantTypes)[keyof typeof GrantTypes];

export const SUPPORTED_SCOPES = Object.freeze([
  "openid",
  "profile",
  "email",
  "shop", // sepet ve sipariş
  "store:manage", // mağaza paneli
  "admin" // yönetim paneli
]) as readonly string[];

/** Yetkilendirme sunucusunda kayıtlı istemci. */
export interface OAuthClient {
  readonly clientId: string;
  readonly redirectUris: readonly string[];
  readonly grantTypes: readonly string[];
  readonly scopes: readonly string[];
}

/**
 * Yönlendirme adresi doğrulaması. OAuth 2.1'in istediği gibi TAM eşleşme aranır;
 * joker ya da ön ek eşleşmesi kabul edilmez (açık yönlendirme açığı).
 */
export function assertRedirectUri(client: OAuthClient, redirectUri: unknown): string {
  if (typeof redirectUri !== "string" || !client.redirectUris.includes(redirectUri)) {
    throw new ValidationError("redirect_uri bu istemci için kayıtlı değil.");
  }
  return redirectUri;
}

export function assertGrantAllowed(client: OAuthClient, grantType: string): void {
  if (!client.grantTypes.includes(grantType)) {
    throw new ValidationError(`Bu istemci ${grantType} akışını kullanamaz.`);
  }
}

/** İstenen izinleri istemcinin izin verilenleriyle kesiştirir. */
export function resolveScope(client: OAuthClient, requested: unknown): string {
  const asked: readonly string[] =
    typeof requested === "string" && requested.trim() ? requested.trim().split(/\s+/) : client.scopes;

  const unknown = asked.filter((scope) => !SUPPORTED_SCOPES.includes(scope));
  if (unknown.length) throw new ValidationError(`Bilinmeyen izin alanı: ${unknown.join(", ")}`);

  const granted = asked.filter((scope) => client.scopes.includes(scope));
  if (!granted.length) throw new ValidationError("İstenen izin alanları bu istemci için geçerli değil.");
  return granted.join(" ");
}
