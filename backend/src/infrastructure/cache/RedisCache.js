"use strict";

const { createClient } = require("redis");

/**
 * Redis önbelleği.
 *
 * Kullanım alanları: katalog sorguları, yetki çözümü, bekleyen OAuth istekleri
 * ve istek sınırlama sayaçları. Önbellek kullanılamazsa sistem çalışmayı
 * sürdürür (sadece yavaşlar) — bu yüzden okuma hataları yutulur.
 */
class RedisCache {
  constructor(url, logger = console) {
    this.logger = logger;
    this.available = false;
    this.client = createClient({
      url,
      socket: { reconnectStrategy: (retries) => Math.min(retries * 200, 5000) }
    });
    this.client.on("error", (error) => {
      if (this.available) this.logger.warn?.("Redis bağlantı hatası: {Reason}", { Reason: error.message });
      this.available = false;
    });
    this.client.on("ready", () => {
      this.available = true;
    });
  }

  async connect() {
    await this.client.connect();
    this.available = true;
  }

  async close() {
    if (this.client.isOpen) await this.client.quit();
  }

  async get(key) {
    if (!this.available) return null;
    try {
      const value = await this.client.get(key);
      return value === null ? null : JSON.parse(value);
    } catch {
      return null;
    }
  }

  async set(key, value, ttlSeconds) {
    if (!this.available) return;
    try {
      await this.client.set(key, JSON.stringify(value), { EX: Math.max(1, Math.floor(ttlSeconds)) });
    } catch {
      /* önbellek yazılamazsa işlem yine de sürer */
    }
  }

  async delete(key) {
    if (!this.available) return;
    try {
      await this.client.del(key);
    } catch {
      /* yok say */
    }
  }

  /** SCAN ile ilerler; KEYS kullanılmaz çünkü büyük veride sunucuyu kilitler. */
  async deleteByPrefix(prefix) {
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

/** Testler ve Redis'siz çalışma için bellek içi karşılık. */
class InMemoryCache {
  constructor() {
    this.store = new Map();
  }

  async get(key) {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }
    return structuredClone(entry.value);
  }

  async set(key, value, ttlSeconds) {
    this.store.set(key, { value: structuredClone(value), expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async delete(key) {
    this.store.delete(key);
  }

  async deleteByPrefix(prefix) {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }

  async close() {}
}

module.exports = { RedisCache, InMemoryCache };
