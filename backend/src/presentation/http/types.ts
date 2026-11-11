"use strict";

/**
 * HTTP katmanının Express isteğine eklediği alanlar.
 *
 * Middleware'ler req üzerine alan yazar (req.auth, req.log, req.cookies ...)
 * ve rotalar bunları okur. JavaScript'te bu bağ görünmezdi: bir middleware
 * sırayı atlarsa ya da alan adı değişirse hata ancak o rota çalışınca
 * ortaya çıkardı. Burada bildirilerek derlemede görünür hale geliyor.
 *
 * Alanlar isteğe bağlı (?) DEĞİL çünkü requestContext ve authenticate zincirin
 * EN BAŞINDA kayıtlı; rotaya ulaşan her istek bunlara sahiptir. null olabilen
 * yerler (auth, guestCartId) ise açıkça null döner — "giriş yapılmamış" geçerli
 * bir durumdur, eksik veri değil.
 */

import type { AccessPolicy } from "../../domain/identity/AccessPolicy";
import type { Logger, Row, Services } from "../../application/shared/contracts";
import type { CommandBus, QueryBus } from "../../application/shared/cqrs/bus";
import type { UseCaseContext } from "../../application/shared/authorize";
import type { AppConfig } from "../../config/env";
import type { RateLimiters } from "./middleware/rateLimiters";

/**
 * Rota kurucularına verilen bağlam.
 *
 * app.ts bunu bir kez kurar ve her rota dosyasına aynı nesneyi geçirir; her
 * dosya yalnızca ihtiyaç duyduğu alanları ayırarak alır. Tipin tek yerde
 * durması, bir rotanın var olmayan bir bağımlılığı istemesini engelliyor.
 */
export interface RouteContext {
  readonly commands: CommandBus<UseCaseContext>;
  readonly queries: QueryBus<UseCaseContext>;
  readonly services: Services;
  readonly config: AppConfig;
  readonly limiters: RateLimiters;
}

/**
 * Gerçek zamanlı bildirim kanalının bu katmana BAKAN yüzü.
 *
 * Somut sınıf (Redis yayınla/abone ol) infrastructure altındadır ve rotalar
 * onu tanımaz — bağımlılık yönü içeri doğru. Burada yalnızca "dinleyebilirim"
 * ve "çalışıyor muyum" soruları var; composition root yapısal olarak uyan
 * nesneyi geçirir.
 *
 * available önemli: kanal kurulamıyorsa uç 503 döner ve istemci YOKLAMAYA
 * düşer. Sessizce boş bir bağlantı açmak, hiç açmamaktan kötüdür — istemci
 * gerçek zamanlı çalıştığını sanıp hiç yoklamaz ve bildirimler görünmez.
 */
export interface NotificationStreamPort {
  readonly available: boolean;
  listen(handler: (notification: { key: string; item: Row }) => void): Promise<void>;
}

/** Jetondan çözülmüş kimlik. Giriş yapılmamışsa req.auth null olur. */
export interface AuthContext {
  /** Makineden makineye jetonlarda (client_credentials) null. */
  readonly userId: string | null;
  readonly sessionId?: string | null;
  readonly clientId?: string | null;
  readonly scope: readonly string[];
  /** İzinler jetondan DEĞİL, her istekte sunucudan çözülür. */
  readonly policy: AccessPolicy;
  readonly isMachine: boolean;
}

declare global {
  namespace Express {
    interface Request {
      /** İstek numarası; günlük ve denetim kaydını uçtan uca bağlar. */
      id: string;
      cookies: Record<string, string>;
      /** RequestId'si gömülü türev günlükçü. */
      log: Logger;
      /** Komut ve sorgulara geçirilen çağrı bağlamı. */
      context(): Row;
      auth: AuthContext | null;
      /** Giriş yapılmışsa null: o zaman kullanıcının kendi sepeti kullanılır. */
      guestCartId: string | null;
    }

    interface Response {
      /** Yeni misafir sepeti açıldığında çerezi günceller. */
      rememberGuestCart(cartId: string | null | undefined): void;
    }
  }
}
