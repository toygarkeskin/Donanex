"use strict";

import type { Services } from "../application/shared/contracts";
import type { AppConfig } from "../config/env";

import { GrantTypes, MOBILE_CLIENT_ID, MOBILE_REDIRECT_URI } from "../domain/identity/OAuthClient";

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
    /*
     * upsertClient bu listeyi ÜZERİNE YAZIYOR, eklemiyor. Yani burada
     * olmayan bir adres bir sonraki açılışta sessizce kaybolur; elle
     * veritabanına eklenen adresler de öyle. Tünelle denerken yerel
     * girişin kırılma sebebi buydu.
     *
     * Aynı adres iki kaynaktan gelebileceği için Set ile tekilleştiriliyor.
     */
    redirectUris: [...new Set([`${base}/auth/callback`, ...config.extraRedirectUris])],
    grantTypes: [GrantTypes.AUTHORIZATION_CODE, GrantTypes.REFRESH_TOKEN],
    scopes: ["openid", "profile", "email", "shop", "store:manage", "admin"],
    isConfidential: false,
    isFirstParty: true
  };

  /*
   * Telefon uygulaması (Donanex Mobil, Expo). O da AÇIK istemci: uygulama
   * paketinin içindeki bir parola herkesin elindedir, PKCE zorunlu.
   * Dönüş adresi uygulamanın kendi şeması; tarayıcı oraya hiç gitmiyor,
   * uygulama yanıttaki adresten kodu kendisi okuyor. Yönetim ve mağaza
   * yetki alanları verilmiyor: paneller web'de.
   */
  const mobile = {
    clientId: MOBILE_CLIENT_ID,
    name: "Donanex Mobil",
    secretHash: null,
    redirectUris: [MOBILE_REDIRECT_URI],
    grantTypes: [GrantTypes.AUTHORIZATION_CODE, GrantTypes.REFRESH_TOKEN],
    scopes: ["openid", "profile", "email", "shop"],
    isConfidential: false,
    isFirstParty: true
  };

  await unitOfWork.run(async ({ oauth }) => {
    await oauth.upsertClient(web);
    await oauth.upsertClient(mobile);
  });
  logger.info("OAuth istemcileri hazır: {ClientIds}", { ClientIds: [web.clientId, mobile.clientId].join(", ") });

  return { web, mobile };
}

