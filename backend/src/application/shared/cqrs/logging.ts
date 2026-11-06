"use strict";

import type { Middleware } from "./bus";
import type { UseCaseContext } from "../authorize";

/** Yapılandırılmış günlük arayüzü (Seq'e CLEF olarak gider). */
export interface Logger {
  debug(template: string, fields?: Record<string, unknown>): void;
  info(template: string, fields?: Record<string, unknown>): void;
  warn(template: string, fields?: Record<string, unknown>): void;
  error(template: string, fields?: Record<string, unknown>): void;
}

/**
 * Her komut ve sorgu için süre ve sonuç günlüğü. Handler'lar bundan habersizdir.
 * Mesaj içeriği YAZILMAZ: parola, jeton ve kişisel veri günlüğe düşmez.
 */
export function loggingMiddleware(logger: Logger): Middleware<UseCaseContext> {
  return async (message, context, next) => {
    const name = message.constructor.name;
    const startedAt = process.hrtime.bigint();
    try {
      const result = await next(message, context);
      const ms = Number(process.hrtime.bigint() - startedAt) / 1e6;
      logger.debug("{Message} tamamlandı ({Duration} ms)", {
        Message: name,
        Duration: Number(ms.toFixed(1)),
        ActorId: context?.actorId ?? null
      });
      return result;
    } catch (error) {
      const ms = Number(process.hrtime.bigint() - startedAt) / 1e6;
      const hata = error instanceof Error ? error : new Error(String(error));
      // Beklenen domain hataları uyarı, beklenmeyenler hata seviyesinde.
      const expected = hata.name.endsWith("Error") && hata.name !== "Error";
      logger[expected ? "warn" : "error"]("{Message} başarısız: {Reason}", {
        Message: name,
        Reason: hata.message,
        ErrorType: hata.name,
        Duration: Number(ms.toFixed(1)),
        ActorId: context?.actorId ?? null,
        ...(expected ? {} : { Stack: hata.stack })
      });
      throw error;
    }
  };
}
