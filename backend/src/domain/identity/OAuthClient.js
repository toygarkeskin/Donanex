"use strict";

const { ValidationError } = require("../shared/errors");

const GrantTypes = Object.freeze({
  AUTHORIZATION_CODE: "authorization_code",
  REFRESH_TOKEN: "refresh_token",
  CLIENT_CREDENTIALS: "client_credentials"
});

const SUPPORTED_SCOPES = Object.freeze([
  "openid",
  "profile",
  "email",
  "shop",        // sepet ve sipariş
  "store:manage", // mağaza paneli
  "admin"         // yönetim paneli
]);

/**
 * Yönlendirme adresi doğrulaması. OAuth 2.1'in istediği gibi TAM eşleşme aranır;
 * joker ya da ön ek eşleşmesi kabul edilmez (açık yönlendirme açığı).
 */
function assertRedirectUri(client, redirectUri) {
  if (typeof redirectUri !== "string" || !client.redirectUris.includes(redirectUri)) {
    throw new ValidationError("redirect_uri bu istemci için kayıtlı değil.");
  }
  return redirectUri;
}

function assertGrantAllowed(client, grantType) {
  if (!client.grantTypes.includes(grantType)) {
    throw new ValidationError(`Bu istemci ${grantType} akışını kullanamaz.`);
  }
}

/** İstenen izinleri istemcinin izin verilenleriyle kesiştirir. */
function resolveScope(client, requested) {
  const asked = typeof requested === "string" && requested.trim()
    ? requested.trim().split(/\s+/)
    : client.scopes;

  const unknown = asked.filter((scope) => !SUPPORTED_SCOPES.includes(scope));
  if (unknown.length) throw new ValidationError(`Bilinmeyen izin alanı: ${unknown.join(", ")}`);

  const granted = asked.filter((scope) => client.scopes.includes(scope));
  if (!granted.length) throw new ValidationError("İstenen izin alanları bu istemci için geçerli değil.");
  return granted.join(" ");
}

module.exports = { GrantTypes, SUPPORTED_SCOPES, assertRedirectUri, assertGrantAllowed, resolveScope };
