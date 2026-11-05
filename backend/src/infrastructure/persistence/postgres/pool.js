"use strict";

const { Pool } = require("pg");

function createPool(dbConfig) {
  const pool = new Pool({
    ...dbConfig,
    max: 10,
    connectionTimeoutMillis: 5000,
    statement_timeout: 15000
  });
  pool.on("error", (error) => {
    console.error("Beklenmeyen PostgreSQL bağlantı hatası:", error.message);
  });
  return pool;
}

/** Veritabanı hazır olana kadar bekler (Docker'da db konteyneri geç açılabilir). */
async function waitForDatabase(pool, { attempts = 30, delayMs = 1000 } = {}) {
  for (let i = 1; i <= attempts; i++) {
    try {
      await pool.query("SELECT 1");
      return;
    } catch (error) {
      if (i === attempts) throw error;
      console.log(`Veritabanı bekleniyor (${i}/${attempts})...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

module.exports = { createPool, waitForDatabase };
