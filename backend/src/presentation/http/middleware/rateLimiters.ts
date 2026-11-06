"use strict";

import rateLimit, { type Options } from "express-rate-limit";
import { RedisStore, type RedisReply } from "rate-limit-redis";
import type { RequestHandler } from "express";

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const passThrough: RequestHandler = (_req, _res, next) => next();

/**
 * Sayaçları Redis'te tutmak için gereken en küçük arayüz.
 *
 * Tüm redis istemcisi değil yalnızca bu tek metot istenir: sınırlayıcı
 * başka bir şeye dokunmasın ve testte yerine küçük bir sahte konabilsin.
 */
export interface RateLimitRedisClient {
  sendCommand(args: string[]): Promise<RedisReply>;
}

export interface RateLimiterOptions {
  readonly enabled?: boolean;
  readonly redisClient?: RateLimitRedisClient | null;
}

/** Uygulamanın kullandığı sınırlayıcılar; adları rotalarda geçer. */
export interface RateLimiters {
  readonly api: RequestHandler;
  readonly signIn: RequestHandler;
  readonly register: RequestHandler;
  readonly token: RequestHandler;
  readonly passwordReset: RequestHandler;
  readonly passwordChange: RequestHandler;
  readonly checkout: RequestHandler;
  readonly tracking: RequestHandler;
  readonly support: RequestHandler;
  readonly storeApplication: RequestHandler;
}

/**
 * İstek sınırları.
 *
 * Sayaçlar Redis'te tutulur: birden çok API konteyneri çalıştığında sınır
 * ortak sayılır ve sunucu yeniden başlayınca sıfırlanmaz.
 *
 * Giriş ve parola uçlarında yalnızca BAŞARISIZ denemeler sayılır; doğru
 * parolayla çalışan kullanıcı sınıra takılmaz.
 */
export function createRateLimiters({ enabled = true, redisClient = null }: RateLimiterOptions = {}): RateLimiters {
  /**
   * Her limitin KENDİ Redis öneki olmalıdır. Ortak önek kullanılırsa bütün
   * limitler tek bir sayacı paylaşır ve en dar limit (ör. kayıt) tüm siteyi
   * kilitler — sessiz ama yıkıcı bir hata.
   */
  const storeFor = (name: string) =>
    redisClient
      ? new RedisStore({
          prefix: `rl:${name}:`,
          sendCommand: (...args: string[]) => redisClient.sendCommand(args)
        })
      : undefined;

  const limiter = (name: string, limit: number, message: string, options: Partial<Options> = {}): RequestHandler =>
    enabled
      ? rateLimit({
          windowMs: FIFTEEN_MINUTES,
          limit,
          standardHeaders: "draft-8",
          legacyHeaders: false,
          store: storeFor(name),
          message: { error: "rate_limited", message },
          ...options
        })
      : passThrough;

  const LATER = "Lütfen daha sonra tekrar deneyin.";
  const failedOnly: Partial<Options> = { skipSuccessfulRequests: true };

  return {
    api: limiter("api", 900, `Çok fazla istek gönderildi. ${LATER}`),
    signIn: limiter("signin", 10, `Çok fazla hatalı giriş denemesi. ${LATER}`, failedOnly),
    register: limiter("register", 10, `Çok fazla kayıt denemesi. ${LATER}`),
    token: limiter("token", 120, `Çok fazla jeton isteği. ${LATER}`),
    passwordReset: limiter("pwreset", 5, `Çok fazla parola sıfırlama isteği. ${LATER}`),
    passwordChange: limiter("pwchange", 10, `Çok fazla deneme. ${LATER}`, failedOnly),
    // Sahte siparişlerle stok kilitlemeyi sınırlar.
    checkout: limiter("checkout", 30, `Çok fazla sipariş denemesi. ${LATER}`),
    tracking: limiter("tracking", 30, `Çok fazla takip denemesi. ${LATER}`),
    support: limiter("support", 10, `Çok fazla destek talebi gönderdiniz. ${LATER}`),
    storeApplication: limiter("storeapp", 3, `Çok fazla mağaza başvurusu. ${LATER}`)
  };
}
