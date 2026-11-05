const normalize = (value) =>
  String(value || "")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

const ALIASES = {
  name: ["name", "urun", "urun adi", "urunadi", "product", "product name"],
  category: ["category", "kategori"],
  price: ["price", "fiyat"],
  stock: ["stock", "stok", "adet", "quantity"],
  image: ["image", "resim", "gorsel", "image url"],
  description: ["description", "aciklama", "urun aciklamasi"]
};

function parseRows(text) {
  const input = text.replace(/^﻿/, "");
  const firstLine = input.split(/\r?\n/, 1)[0] || "";
  const delimiter = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ";" : ",";

  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  const endRow = () => {
    row.push(cell.trim());
    if (row.some((value) => value !== "")) rows.push(row);
    row = [];
    cell = "";
  };

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === '"') {
      if (quoted && input[i + 1] === '"') {
        cell += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (ch === delimiter && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((ch === "\n" || ch === "\r") && !quoted) {
      if (ch === "\r" && input[i + 1] === "\n") i++;
      endRow();
    } else {
      cell += ch;
    }
  }
  endRow();
  return rows;
}

/** CSV metnini ürün listesine çevirir; hatalı satırı numarasıyla bildirir. */
export function parseProductCsv(text) {
  const rows = parseRows(text);
  if (rows.length < 2) throw new Error("CSV dosyasında başlık ve en az bir ürün bulunmalı.");

  const headers = rows.shift().map(normalize);
  const indexes = {};
  for (const [key, names] of Object.entries(ALIASES)) {
    indexes[key] = headers.findIndex((header) => names.includes(header));
  }
  if (indexes.name < 0 || indexes.price < 0) {
    throw new Error("CSV başlıklarında en az name/urun ve price/fiyat sütunları olmalı.");
  }
  if (rows.length > 500) throw new Error("Tek seferde en fazla 500 ürün içe aktarabilirsin.");

  return rows.map((values, index) => {
    const get = (key) => (indexes[key] < 0 ? "" : (values[indexes[key]] || "").trim());
    const line = index + 2;

    const priceText = get("price");
    const price = Number(priceText.includes(",") ? priceText.replace(/\./g, "").replace(",", ".") : priceText);
    const stockText = get("stock");
    const stock = stockText === "" ? 0 : Number(stockText.replace(",", "."));

    if (!get("name")) throw new Error(`${line}. satırda ürün adı boş.`);
    if (!priceText || !Number.isFinite(price) || price < 0) throw new Error(`${line}. satırda fiyat geçersiz.`);
    if (!Number.isInteger(stock) || stock < 0) throw new Error(`${line}. satırda stok tam sayı ve 0 veya daha büyük olmalı.`);

    return {
      name: get("name"),
      category: get("category"),
      price,
      stock,
      image: get("image"),
      description: get("description")
    };
  });
}
