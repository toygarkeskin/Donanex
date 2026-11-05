"use strict";

const { ValidationError } = require("../shared/errors");
const { isNonEmptyString } = require("../shared/guards");
const { toCents, centsToDecimalString } = require("../shared/money");

const MAX_STOCK = 1_000_000;
const MAX_DESCRIPTION = 5000;
const DEFAULT_IMAGE = "/assets/images/urunler/laptopcard.png";

/** Görsel yalnızca sitenin kendi dosyalarından veya HTTPS adresinden gelebilir. */
function isSafeImage(value) {
  if (!isNonEmptyString(value, 500)) return false;
  const image = value.trim();
  if (/[\s"'<>\\]/.test(image)) return false;
  if (image.startsWith("/assets/") && !image.includes("..")) return true;
  try {
    return new URL(image).protocol === "https:";
  } catch {
    return false;
  }
}

/** Ürün varlığı. Yazma tarafında (command) kullanılır. */
class Product {
  constructor({ id = null, name, description, priceCents, image, category, stock }) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.priceCents = priceCents;
    this.image = image;
    this.category = category;
    this.stock = stock;
    Object.freeze(this);
  }

  get price() {
    return centsToDecimalString(this.priceCents);
  }

  /** Yönetici formundan gelen veriyi doğrular. Tüm alanlar zorunludur. */
  static create(input, message = "Ürün bilgilerini ve fiyatını kontrol edin.") {
    const body = input || {};
    const stock = typeof body.stock === "string" && body.stock.trim() === "" ? NaN : Number(body.stock);
    const priceCents = toCents(body.price);

    const valid =
      body.stock !== null &&
      Number.isInteger(stock) &&
      stock >= 0 &&
      stock <= MAX_STOCK &&
      isNonEmptyString(body.name, 250) &&
      isNonEmptyString(body.description, MAX_DESCRIPTION) &&
      priceCents !== null &&
      isNonEmptyString(body.category, 100);

    if (!valid) throw new ValidationError(message);
    if (!isSafeImage(body.image)) {
      throw new ValidationError("Görsel yolu /assets/ ile veya https:// ile başlamalı.");
    }

    return new Product({
      id: body.id ?? null,
      name: body.name.trim(),
      description: body.description.trim(),
      priceCents,
      image: body.image.trim(),
      category: body.category.trim(),
      stock
    });
  }

  /** CSV ile toplu içe aktarma: yalnızca ad ve fiyat zorunlu, diğerleri varsayılanla dolar. */
  static fromImportRow(row, rowNumber) {
    const r = row || {};
    const name = typeof r.name === "string" ? r.name.trim() : "";
    const filled = {
      name,
      price: r.price,
      stock: r.stock === undefined || r.stock === "" ? 0 : r.stock,
      category: isNonEmptyString(r.category) ? r.category : "Genel",
      image: isNonEmptyString(r.image) ? r.image : DEFAULT_IMAGE,
      description: isNonEmptyString(r.description) ? r.description : name
    };
    return Product.create(filled, `${rowNumber}. satırdaki ürün bilgileri geçersiz.`);
  }
}

module.exports = { Product, MAX_STOCK, isSafeImage };
