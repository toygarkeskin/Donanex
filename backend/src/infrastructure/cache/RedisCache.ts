"use strict";

import { createClient, type RedisClientType } from "redis";

import type { Cache, Logger } from "../../application/shared/contracts";

/**
 * Redis önbelleği.
 *
 * Kullanım alanları: katalog sorguları, yetki çözümü, bekleyen OAuth istekleri
 * ve istek sınırlama sayaçları. Önbellek kullanılamazsa sistem çalışmayı
 * sürdürür (sadece yavaşlar) — bu yüzden okuma hataları yutulur.
 */
export class RedisCache implements Cache {
  private readonly logger: Partial<Logger>;
  /**
   * Ham istemci. İstek sınırlayıcı sayaçlarını doğrudan Redis komutlarıyla
   * tuttuğu için dışarı açıldı; önbellek okuma/yazması için kullanılmaz.
   */
  readonly client: RedisClientType;
  /** Bağlantı kopmuşsa önbelleğe hiç gidilmez, doğrudan kaynağa düşülür. */
  available = false;

  constructor(url: string, logger: Partial<Logger> = console) {
    this.logger = logger;
    this.client = createClient({
      url,
      socket: { reconnectStrategy: (retries: number) => Math.min(retries * 200, 5000) }
    }) as RedisClientType;

    this.client.on("error", (error: Error) => {
      if (this.available) this.logger.warn?.("Redis bağlantı hatası: {Reason}", { Reason: error.message });
      this.available = false;
    });
    this.client.on("ready", () => {
      this.available = true;
    });
  }

  async connect(): Promise<void> {
    await this.client.connect();
    this.available = true;
  }

  async close(): Promise<void> {
    if (this.client.isOpen) await this.client.quit();
  }

  async get<T = any>(key: string): Promise<T | null> {
    if (!this.available) return null;
    try {
      const value = await this.client.get(key);
      return value === null ? null : (JSON.parse(value) as T);
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (!this.available) return;
    try {
      await this.client.set(key, JSON.stringify(value), { EX: Math.max(1, Math.floor(ttlSeconds)) });
    } catch {
      /* önbellek yazılamazsa işlem yine de sürer */
    }
  }

  async delete(key: string): Promise<void> {
    if (!this.available) return;
    try {
      await this.client.del(key);
    } catch {
      /* yok say */
    }
  }

  /** SCAN ile ilerler; KEYS kullanılmaz çünkü büyük veride sunucuyu kilitler. */
  async deleteByPrefix(prefix: string): Promise<void> {
    if (!this.available) return;
    try {
      for await (const keys of this.client.scanIterator({ MATCH: `${prefix}*`, COUNT: 200 })) {
        const batch = Array.isArray(keys) ? keys : [keys];
        if (batch.length) await this.client.del(batch);
      }
    } catch {
      /* yok say */
    }
  }
}

interface CacheEntry {
  readonly value: unknown;
  readonly expiresAt: number;
}

/** Testler ve Redis'siz çalışma için bellek içi karşılık. */
export class InMemoryCache implements Cache {
  private readonly store = new Map<string, CacheEntry>();

  async get<T = any>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }
    return structuredClone(entry.value) as T;
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    this.store.set(key, { value: structuredClone(value), expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async deleteByPrefix(prefix: string): Promise<void> {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }

  async close(): Promise<void> {}
}
