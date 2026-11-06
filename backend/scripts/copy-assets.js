"use strict";

/*
 * Derleme sonrası kod olmayan dosyaları çıktı klasörüne kopyalar.
 *
 * tsc yalnızca .ts/.js derler; .sql göç dosyaları çıktıya girmez. migrate.ts
 * bunları __dirname'e göre aradığı için çıktı içinde aynı konumda bulunmalılar,
 * yoksa açılışta "migrations klasörü yok" hatası alınır.
 *
 * İki farklı çıktı düzeni var; bu yüzden rootDir parametre:
 *   üretim  → tsconfig.build.json, rootDir "src" → dist/infrastructure/...
 *   testler → tsconfig.json,       rootDir "."   → .build/src/infrastructure/...
 *
 * Kullanım: node scripts/copy-assets.js [çıktıKlasörü] [rootDir]
 */

const fs = require("node:fs");
const path = require("node:path");

const KOK = path.resolve(__dirname, "..");
const CIKTI = process.argv[2] || "dist";
const ROOT_DIR = process.argv[3] || "src";

/** Kaynak ağacındaki, koda ait olmayan klasörler. */
const KOPYALANACAKLAR = ["src/infrastructure/persistence/postgres/migrations"];

function kopyala(kaynak, hedef) {
  fs.mkdirSync(hedef, { recursive: true });
  for (const girdi of fs.readdirSync(kaynak, { withFileTypes: true })) {
    const k = path.join(kaynak, girdi.name);
    const h = path.join(hedef, girdi.name);
    if (girdi.isDirectory()) kopyala(k, h);
    else fs.copyFileSync(k, h);
  }
}

let toplam = 0;
for (const göreli of KOPYALANACAKLAR) {
  const kaynak = path.join(KOK, göreli);
  if (!fs.existsSync(kaynak)) {
    throw new Error(`Kopyalanacak klasör yok: ${göreli}`);
  }

  // rootDir "src" ise tsc çıktıda "src/" önekini düşürür; "." ise korur.
  const hedefGöreli = ROOT_DIR === "src" ? göreli.replace(/^src[\\/]/, "") : göreli;
  const hedef = path.join(KOK, CIKTI, hedefGöreli);

  kopyala(kaynak, hedef);
  const sayi = fs.readdirSync(kaynak).length;
  toplam += sayi;
  console.log(`  ${göreli} -> ${CIKTI}/${hedefGöreli}  (${sayi} dosya)`);
}

console.log(`Varlık kopyalama tamam: ${toplam} dosya.`);
