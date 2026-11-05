"use strict";

const img = (path) => `/assets/images/urunler/${path}`;

/** Ürün tablosu boşsa örnek ürünleri ekler (yalnızca ilk kurulumda). Fiyatlar örnektir. */
const SEED_PRODUCTS = [
  ["GIGABYTE GAMING A16 Laptop", "GIGABYTE GAMING A16 Ryzen 7 260, 16GB DDR5, RTX 5060, 16 inç FHD 165Hz Gaming Notebook", 67000, img("laptopcard.png"), "Laptop", 10],
  ["HP ProBook İş Laptopu", "HP ProBook 15.6 inç, Intel Core i5, 16GB RAM, 512GB SSD iş bilgisayarı", 38500, img("katalog/probook.webp"), "Laptop", 8],
  ["MSI RTX 5060 Ti Ekran Kartı", "MSI GeForce RTX 5060 Ti SHADOW 2X OC PLUS 8GB GDDR7, DLSS 4, 128 Bit ekran kartı", 25000, img("ekrankarticard.png"), "Ekran Kartı", 10],
  ["ASUS Dual Ekran Kartı", "ASUS Dual GeForce RTX serisi 8GB GDDR6 çift fanlı ekran kartı", 21500, img("asusdual.jpg"), "Ekran Kartı", 6],
  ["Intel Core i7-11700KF İşlemci", "Intel Core i7-11700KF 8 çekirdek 16 izlek LGA1200 işlemci", 9800, img("katalog/i7-11700kf.jpg"), "İşlemci", 12],
  ["Logitech G515 TKL Klavye", "Logitech G515 TKL RGB mekanik siyah kablolu gaming klavye", 5700, img("klavyecard.png"), "Klavye", 10],
  ["A4Tech Bloody R73 Mouse", "A4Tech Bloody R73 ULTRA 20000 CPI siyah kablosuz gaming mouse", 2600, img("mausecard.png"), "Mouse", 10],
  ["SteelSeries Rival Mouse", "SteelSeries Rival serisi hafif kablolu oyuncu mouse", 1900, img("katalog/rival.png"), "Mouse", 15],
  ["Razer Kraken V3 Kulaklık", "Razer Kraken V3 7.1 surround USB oyuncu kulaklığı", 3900, img("katalog/razerkrakenv3.jpg"), "Kulaklık", 9],
  ["Xbox Kablosuz Kumanda", "Xbox Wireless Controller mavi kablosuz oyun kumandası", 3200, img("xboxkolmavi.jpg"), "Oyun Kumandası", 7],
  ["Excalibur 27 inç Monitör", "Casper Excalibur 27 inç 165Hz oyuncu monitörü", 8900, img("katalog/excalibur-monitor-27.jpg"), "Monitör", 5],
  ["LG UltraGear Monitör", "LG UltraGear 27 inç IPS 144Hz oyuncu monitörü", 10400, img("katalog/lgmonitor.jpg"), "Monitör", 4],
  ["1TB NVMe SSD", "1TB M.2 NVMe PCIe Gen4 yüksek hızlı SSD", 3100, img("ssd.png"), "Depolama", 20]
];

async function seedProductsIfEmpty(pool, log = console.log) {
  const { rows } = await pool.query("SELECT COUNT(*)::int AS total FROM products");
  if (rows[0].total > 0) return;

  for (const product of SEED_PRODUCTS) {
    await pool.query(
      `INSERT INTO products (name, description, price, image, category, stock)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      product
    );
  }
  log(`${SEED_PRODUCTS.length} örnek ürün veritabanına eklendi.`);
}

module.exports = { seedProductsIfEmpty };
