#!/usr/bin/env node
"use strict";

/**
 * Yedek alır: veritabanı + yüklenen görseller.
 *
 * Neden iki parça: ikisi ayrı volume'de duruyor (db-data ve uploads) ve
 * ikisi de kaybolabilir. Yalnızca veritabanını yedeklemek, geri dönüldüğünde
 * ürünleri olup fotoğrafları olmayan bir katalog bırakırdı.
 *
 * Node ile yazıldı çünkü projenin geri kalan araçları da Node; böylece
 * Windows'ta Git Bash gerekmeden, PowerShell'den de çalışır.
 *
 * Kullanım:
 *   node scripts/yedek-al.js            # yedekler/ altına yazar
 *   node scripts/yedek-al.js --sakla 14 # son 14 yedeği tutar (varsayılan 7)
 */

const { execFileSync, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const KOK = path.resolve(__dirname, "..");
const HEDEF = path.join(KOK, "yedekler");

/** Kaç yedek saklanacak. Eskiler silinir ki disk dolmasın. */
const VARSAYILAN_SAKLAMA = 7;

function argSayi(ad, varsayilan) {
  const i = process.argv.indexOf(ad);
  if (i < 0) return varsayilan;
  const deger = Number(process.argv[i + 1]);
  return Number.isInteger(deger) && deger > 0 ? deger : varsayilan;
}

/** 2026-11-09T14-05-33 biçiminde, dosya adında kullanılabilir damga. */
function damga() {
  return new Date().toISOString().replace(/\..+$/, "").replace(/:/g, "-");
}

function compose(args, secenekler = {}) {
  return spawnSync("docker", ["compose", ...args], {
    cwd: KOK,
    encoding: secenekler.ikili ? "buffer" : "utf8",
    maxBuffer: 1024 * 1024 * 512,
    ...secenekler
  });
}

/** Servis ayakta mı? Değilse yedek boş çıkar ve kimse fark etmez. */
function servisAyaktaMi(servis) {
  const sonuc = compose(["ps", "-q", servis]);
  return sonuc.status === 0 && sonuc.stdout.trim().length > 0;
}

function hata(mesaj) {
  console.error(`HATA: ${mesaj}`);
  process.exit(1);
}

function main() {
  const saklama = argSayi("--sakla", VARSAYILAN_SAKLAMA);

  if (!servisAyaktaMi("db")) {
    hata('Veritabanı konteyneri çalışmıyor. Önce "docker compose up -d" çalıştırın.');
  }

  fs.mkdirSync(HEDEF, { recursive: true });
  const d = damga();

  /* ---------------- veritabanı ---------------- */
  // pg_dump konteynerin İÇİNDE çalışır; kullanıcı ve veritabanı adını
  // oradaki ortam değişkenlerinden okur, böylece .env burada okunmaz.
  const sqlYolu = path.join(HEDEF, `donanex-${d}.sql.gz`);
  const dokum = compose(
    ["exec", "-T", "db", "sh", "-c", 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"'],
    { ikili: true }
  );
  if (dokum.status !== 0) {
    hata(`pg_dump başarısız:\n${dokum.stderr?.toString() ?? ""}`);
  }
  if (!dokum.stdout || dokum.stdout.length === 0) {
    hata("pg_dump boş çıktı verdi; yedek yazılmadı.");
  }
  fs.writeFileSync(sqlYolu, zlib.gzipSync(dokum.stdout));

  /* ---------------- yüklenen görseller ---------------- */
  // Görseller API konteynerindeki /app/var/uploads altında (uploads volume).
  // API kapalıysa bu adım atlanır, veritabanı yedeği yine de alınmış olur.
  let gorselYolu = null;
  if (servisAyaktaMi("api")) {
    const tar = compose(["exec", "-T", "api", "sh", "-c", "tar -cz -C /app/var uploads"], { ikili: true });
    if (tar.status === 0 && tar.stdout?.length) {
      gorselYolu = path.join(HEDEF, `donanex-${d}-gorseller.tar.gz`);
      fs.writeFileSync(gorselYolu, tar.stdout);
    } else {
      console.warn("UYARI: Görseller yedeklenemedi; veritabanı yedeği alındı.");
    }
  } else {
    console.warn("UYARI: API konteyneri kapalı, görseller yedeklenmedi.");
  }

  /* ---------------- eski yedekleri temizle ---------------- */
  const sqlYedekleri = fs
    .readdirSync(HEDEF)
    .filter((ad) => /^donanex-.*\.sql\.gz$/.test(ad))
    .sort()
    .reverse();

  for (const eski of sqlYedekleri.slice(saklama)) {
    fs.rmSync(path.join(HEDEF, eski), { force: true });
    // Aynı damgaya ait görsel yedeği de gider.
    const esi = eski.replace(/\.sql\.gz$/, "-gorseller.tar.gz");
    fs.rmSync(path.join(HEDEF, esi), { force: true });
  }

  const boyut = (yol) => `${(fs.statSync(yol).size / 1024 / 1024).toFixed(2)} MB`;
  console.log("Yedek alındı:");
  console.log(`  veritabanı : ${path.relative(KOK, sqlYolu)}  (${boyut(sqlYolu)})`);
  if (gorselYolu) console.log(`  görseller  : ${path.relative(KOK, gorselYolu)}  (${boyut(gorselYolu)})`);
  console.log(`  saklanan   : en yeni ${saklama} yedek`);
}

main();
