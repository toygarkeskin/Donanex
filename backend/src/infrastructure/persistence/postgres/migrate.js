"use strict";

const fs = require("fs/promises");
const path = require("path");

const MIGRATIONS_DIR = path.join(__dirname, "migrations");
const LOCK_KEY = 7705_2026; // aynı anda iki sunucu migration çalıştırmasın

/**
 * migrations/ klasöründeki .sql dosyalarını ad sırasıyla, her birini kendi
 * transaction'ında ve yalnızca bir kez çalıştırır.
 */
async function runMigrations(pool, log = console.log) {
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock($1)", [LOCK_KEY]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name       VARCHAR(200) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const applied = new Set(
      (await client.query("SELECT name FROM schema_migrations")).rows.map((row) => row.name)
    );
    const files = (await fs.readdir(MIGRATIONS_DIR)).filter((file) => file.endsWith(".sql")).sort();

    let count = 0;
    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = await fs.readFile(path.join(MIGRATIONS_DIR, file), "utf8");
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
        await client.query("COMMIT");
        log(`Migration uygulandı: ${file}`);
        count++;
      } catch (error) {
        await client.query("ROLLBACK");
        throw new Error(`Migration başarısız (${file}): ${error.message}`);
      }
    }
    return { applied: count, total: files.length };
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [LOCK_KEY]).catch(() => {});
    client.release();
  }
}

module.exports = { runMigrations };
