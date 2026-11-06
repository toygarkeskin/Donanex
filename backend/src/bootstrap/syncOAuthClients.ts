"use strict";

import type { Services } from "../application/shared/contracts";
import type { AppConfig } from "../config/env";

import { GrantTypes } from "../domain/identity/OAuthClient";

/**
 * Sistemin kendi OAuth istemcilerini tanımlar.
 *
 *  donanex-web  — tarayıcıdaki Vue uygulaması. AÇIK (public) istemcidir:
 *               parola saklayamaz, bu yüzden PKCE zorunludur.
 *  donanex-ops  — makineden makineye entegrasyon örneği. GİZLİ istemcidir;
 *               parolası yalnızca ilk oluşturmada gösterilir.
 */
export async function syncOAuthClients({
  unitOfWork,
  logger,
  config
}: Pick<Services, "unitOfWork" | "logger"> & { config: AppConfig }) {
  const base = config.publicUrl;

  const web = {
    clientId: "donanex-web",
    name: "Donanex Web",
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

