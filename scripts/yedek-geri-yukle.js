#!/usr/bin/env node
"use strict";

/**
 * Yedekten geri yükler.
 *
 * BU İŞLEM VERİ SİLER: hedef veritabanının şeması düşürülüp yedekteki hâliyle
 * yeniden kurulur. Bu yüzden yalnızca --onayla verildiğinde çalışır; yanlışlıkla
 * çalıştırılıp çalışan sistemi geri sarmasın.
 *
 * --deneme ile AYRI bir veritabanına yükler ve sonra siler. Yedeğin gerçekten
 * geri yüklenebildiğini, canlı veriye dokunmadan kanıtlamanın yolu budur:
 * denenmemiş yedek, yedek sayılmaz.
 *
 * Kullanım:
 *   node scripts/yedek-geri-yukle.js --deneme                       # en yeni yedeği dener
 *   node scripts/yedek-geri-yukle.js yedekler/donanex-....sql.gz --deneme
 *   node scripts/yedek-geri-yukle.js yedekler/donanex-....sql.gz --onayla
 */

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const KOK = path.resolve(__dirname, "..");
const HEDEF = path.join(KOK, "yedekler");
const DENEME_VERITABANI = "donanex_yedek_denemesi";

function hata(mesaj) {
  console.error(`HATA: ${mesaj}`);
  process.exit(1);
}

function compose(args, secenekler = {}) {
  return spawnSync("docker", ["compose", ...args], {
    cwd: KOK,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 512,
    ...secenekler
  });
}

/** psql'i konteynerde çalıştırır; SQL stdin'den verilir. */
function psql(veritabani, sql) {
  return compose(["exec", "-T", "db", "sh", "-c", `psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d ${veritabani}`], {
    input: sql
  });
}

/** Bakım komutları: veritabanı yaratma/düşürme postgres üzerinden yapılır. */
function bakim(sql) {
  return compose(["exec", "-T", "db", "sh", "-c", `psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d postgres -c "${sql}"`]);
}

function enYeniYedek() {
  if (!fs.existsSync(HEDEF)) return null;
  const liste = fs
    .readdirSync(HEDEF)
    .filter((ad) => /^donanex-.*\.sql\.gz$/.test(ad))
    .sort()
    .reverse();
  return liste.length ? path.join(HEDEF, liste[0]) : null;
}

function main() {
  const deneme = process.argv.includes("--deneme");
  const onayli = process.argv.includes("--onayla");
  const verilen = process.argv.slice(2).find((a) => !a.startsWith("--"));

  const yedek = verilen ? path.resolve(KOK, verilen) : enYeniYedek();
  if (!yedek || !fs.existsSync(yedek)) {
    hata("Geri yüklenecek yedek bulunamadı. Önce: node scripts/yedek-al.js");
  }

  if (!deneme && !onayli) {
    console.error("Bu işlem hedef veritabanındaki TÜM VERİYİ yedektekiyle değiştirir.");
    console.error("");
    console.error("  Denemek için (canlı veriye dokunmaz):");
    console.error("    node scripts/yedek-geri-yukle.js --deneme");
    console.error("");
    console.error("  Gerçekten geri yüklemek için:");
    console.error(`    node scripts/yedek-geri-yukle.js ${path.relative(KOK, yedek)} --onayla`);
    process.exit(1);
  }

  const sql = zlib.gunzipSync(fs.readFileSync(yedek)).toString("utf8");
  console.log(`Yedek: ${path.relative(KOK, yedek)} (${(sql.length / 1024 / 1024).toFixed(2)} MB açılmış)`);

  if (deneme) {
    // Ayrı bir veritabanına yükle, doğrula, sonra sil. Canlı veri bu akışta
    // hiç açılmaz.
    bakim(`DROP DATABASE IF EXISTS ${DENEME_VERITABANI}`);
    const yarat = bakim(`CREATE DATABASE ${DENEME_VERITABANI}`);
    if (yarat.status !== 0) hata(`Deneme veritabanı yaratılamadı:\n${yarat.stderr}`);

    const yukle = psql(DENEME_VERITABANI, sql);
    if (yukle.status !== 0) {
      bakim(`DROP DATABASE IF EXISTS ${DENEME_VERITABANI}`);
      hata(`Yedek geri yüklenemedi:\n${yukle.stderr}`);
    }

    const sayim = psql(
      DENEME_VERITABANI,
      "SELECT 'urun='||(SELECT COUNT(*) FROM products)||' siparis='||(SELECT COUNT(*) FROM orders)||' kullanici='||(SELECT COUNT(*) FROM users);"
    );
    console.log("Deneme başarılı. Yedekteki içerik:");
    console.log(`  ${sayim.stdout.split("\n").find((s) => s.includes("urun="))?.trim() ?? "(sayılamadı)"}`);

    bakim(`DROP DATABASE IF EXISTS ${DENEME_VERITABANI}`);
    console.log("Deneme veritabanı silindi. Canlı veriye dokunulmadı.");
    return;
  }

  // Gerçek geri yükleme: şema düşürülür, yedek olduğu gibi yüklenir.
  const yukle = psql('"$POSTGRES_DB"', `DROP SCHEMA public CASCADE;\nCREATE SCHEMA public;\n${sql}`);
  if (yukle.status !== 0) hata(`Geri yükleme başarısız:\n${yukle.stderr}`);

  console.log("Geri yüklendi.");
  console.log("Görseller ayrı bir dosyada; aynı damgalı *-gorseller.tar.gz dosyasını");
  console.log("şu komutla açın:");
  console.log("  docker compose exec -T api sh -c 'tar -xz -C /app/var' < yedekler/<dosya>-gorseller.tar.gz");
}

main();
