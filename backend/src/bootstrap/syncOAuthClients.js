"use strict";

const { GrantTypes } = require("../domain/identity/OAuthClient");

/**
 * Sistemin kendi OAuth istemcilerini tanımlar.
 *
 *  pazar-web  — tarayıcıdaki Vue uygulaması. AÇIK (public) istemcidir:
 *               parola saklayamaz, bu yüzden PKCE zorunludur.
 *  pazar-ops  — makineden makineye entegrasyon örneği. GİZLİ istemcidir;
 *               parolası yalnızca ilk oluşturmada gösterilir.
 */
async function syncOAuthClients({ unitOfWork, passwordHasher, config, logger }) {
  const base = config.publicUrl;

  const web = {
    clientId: "pazar-web",
    name: "Pazar Web",
    secretHash: null,
    redirectUris: [
      `${base}/auth/callback`,
      // Vite geliştirme sunucusu için.
      "http://localhost:5173/auth/callback"
    ],
    grantTypes: [GrantTypes.AUTHORIZATION_CODE, GrantTypes.REFRESH_TOKEN],
    scopes: ["openid", "profile", "email", "shop", "store:manage", "admin"],
    isConfidential: false,
    isFirstParty: true
  };

  await unitOfWork.run(({ oauth }) => oauth.upsertClient(web));
  logger.info("OAuth istemcisi hazır: {ClientId}", { ClientId: web.clientId });

  return { web };
}

module.exports = { syncOAuthClients };
