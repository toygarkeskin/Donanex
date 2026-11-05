"use strict";

/**
 * Her komut ve sorgu için süre ve sonuç günlüğü. Handler'lar bundan habersizdir.
 * Mesaj içeriği YAZILMAZ: parola, jeton ve kişisel veri günlüğe düşmez.
 */
function loggingMiddleware(logger) {
  return async (message, context, next) => {
    const name = message.constructor.name;
    const startedAt = process.hrtime.bigint();
    try {
      const result = await next(message, context);
      const ms = Number(process.hrtime.bigint() - startedAt) / 1e6;
      logger.debug("{Message} tamamlandı ({Duration} ms)", {
        Message: name,
        Duration: Number(ms.toFixed(1)),
        ActorId: context.actorId ?? null
      });
      return result;
    } catch (error) {
      const ms = Number(process.hrtime.bigint() - startedAt) / 1e6;
      // Beklenen domain hataları uyarı, beklenmeyenler hata seviyesinde.
      const expected = error.name?.endsWith("Error") && error.name !== "Error" && !!error.constructor;
      logger[expected ? "warn" : "error"]("{Message} başarısız: {Reason}", {
        Message: name,
        Reason: error.message,
        ErrorType: error.name,
        Duration: Number(ms.toFixed(1)),
        ActorId: context.actorId ?? null,
        ...(expected ? {} : { Stack: error.stack })
      });
      throw error;
    }
  };
}

module.exports = { loggingMiddleware };
