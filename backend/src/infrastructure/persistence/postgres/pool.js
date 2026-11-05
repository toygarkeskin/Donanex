"use strict";

const { Pool, types } = require("pg");

/**
 * BIGINT (int8) sütunları pg varsayılan olarak STRING döndürür: 2^53 üstü
 * değerlerde hassasiyet kaybı olmasın diye. Bizim tüm BIGINT alanlarımız
 * (kuruş tutarları, sıra numaraları) güvenli tam sayı aralığındadır.
 *
 * Çevirmezsek "6700000" gibi metinler para hesaplarına karışır ve
 * Money sınıfı bunları geçersiz sayar. Bu yüzden tek yerde sayıya çeviriyoruz.
 */
types.setTypeParser(types.builtins.INT8, (value) => (value === null ? null : Number(value)));

function createPool(dbConfig) {
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

  pool.on("error", (error) => {
    console.error("Beklenmeyen PostgreSQL bağlantı hatası:", error.message);
  });
  return pool;
}

/** Veritabanı hazır olana kadar bekler (Docker'da db konteyneri geç açılabilir). */
async function waitForDatabase(pool, { attempts = 30, delayMs = 1000, log = console.log } = {}) {
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

module.exports = { createPool, waitForDatabase };
