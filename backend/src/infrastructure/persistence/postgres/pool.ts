"use strict";

import { Pool, types, type PoolClient } from "pg";

/**
 * BIGINT (int8) sütunları pg varsayılan olarak STRING döndürür: 2^53 üstü
 * değerlerde hassasiyet kaybı olmasın diye. Bizim tüm BIGINT alanlarımız
 * (kuruş tutarları, sıra numaraları) güvenli tam sayı aralığındadır.
 *
 * Çevirmezsek "6700000" gibi metinler para hesaplarına karışır ve
 * Money sınıfı bunları geçersiz sayar. Bu yüzden tek yerde sayıya çeviriyoruz.
 */
types.setTypeParser(types.builtins.INT8, (value: string | null) => (value === null ? null : Number(value)));

export interface DbConfig {
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly user: string;
  readonly password: string;
  readonly poolSize?: number;
}

export function createPool(dbConfig: DbConfig): Pool {
  const pool = new Pool({
    host: dbConfig.host,
    port: dbConfig.port,
    database: dbConfig.database,
    user: dbConfig.user,
    password: dbConfig.password,
    max: dbConfig.poolSize ?? 10,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30_000,
    // Tek bir sorgu bağlantıyı sonsuza dek meşgul edemesin.
    statement_timeout: 15_000
  });

  pool.on("error", (error: Error) => {
    console.error("Beklenmeyen PostgreSQL bağlantı hatası:", error.message);
  });
  return pool;
}

/** Veritabanı hazır olana kadar bekler (Docker'da db konteyneri geç açılabilir). */
export async function waitForDatabase(
  pool: Pool,
  {
    attempts = 30,
    delayMs = 1000,
    log = console.log
  }: { attempts?: number; delayMs?: number; log?: (message: string) => void } = {}
): Promise<void> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await pool.query("SELECT 1");
      return;
    } catch (error) {
      if (attempt === attempts) throw error;
      log(`Veritabanı bekleniyor (${attempt}/${attempts})...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

/** Repository'lerin aldığı bağlantı: havuz ya da transaction içindeki istemci. */
export type Db = Pool | PoolClient;
