"use strict";

const { ValidationError } = require("../shared/errors");
const { Money } = require("../shared/Money");
const { requireText, optionalText, requireEnum, slugify, isNonEmptyString } = require("../shared/guards");

const ProductStatus = Object.freeze({
  DRAFT: "draft",       // yalnızca mağaza görür
  ACTIVE: "active",     // vitrinde
  ARCHIVED: "archived"  // satıştan kaldırıldı, geçmiş siparişler korunur
});

const MAX_STOCK = 1_000_000;

/**
 * Ürün görseli yalnızca sitenin kendi dosyalarından ya da HTTPS adresinden gelebilir.
 * javascript:, data: ve http: adresleri reddedilir.
 */
function assertImageUrl(value) {
  const image = isNonEmptyString(value, 500) ? value.trim() : "";
  if (!image) throw new ValidationError("Görsel adresi zorunludur.");
  if (/[\s"'<>\\]/.test(image)) throw new ValidationError("Görsel adresi geçersiz karakter içeriyor.");
  if (image.startsWith("/images/") && !image.includes("..")) return image;
  // Panelden yüklenen görseller. Ad sunucuda üretildiği için kalıbı sabittir;
  // serbest bir yol değil, yalnızca bu biçim kabul edilir.
  if (/^\/yuklenen\/[0-9a-f]{32}\.(png|jpg|webp)$/.test(image)) return image;
  try {
    if (new URL(image).protocol === "https:") return image;
  } catch {
    /* aşağıda reddedilir */
  }
  throw new ValidationError("Görsel adresi /images/ ile, /yuklenen/ ile veya https:// ile başlamalı.");
}

function assertStock(value) {
  const stock = typeof value === "string" && /^\d+$/.test(value.trim()) ? Number(value) : value;
  if (!Number.isInteger(stock) || stock < 0 || stock > MAX_STOCK) {
    throw new ValidationError(`Stok 0 ile ${MAX_STOCK} arasında bir tam sayı olmalı.`);
  }
  return stock;
}

/**
 * Ürün varlığı. Fiyat her zaman Money'dir; vitrin ve sipariş aynı değeri kullanır.
 */
class Product {
  constructor(fields) {
    Object.assign(this, fields);
    Object.freeze(this);
  }

  static create(input) {
    const data = input || {};
    const name = requireText(data.name, "Ürün adı", 250);

    return new Product({
      id: data.id ?? null,
      storeId: data.storeId ?? null,
      categoryId: data.categoryId ?? null,
      name,
      slug: slugify(data.slug || name),
      sku: optionalText(data.sku, "Stok kodu", 60),
      description: requireText(data.description, "Ürün açıklaması", 5000),
      price: Money.fromAmount(data.price, "Fiyat"),
      stock: assertStock(data.stock),
      imageUrl: assertImageUrl(data.imageUrl),
      status: requireEnum(data.status ?? ProductStatus.ACTIVE, Object.values(ProductStatus), "Ürün durumu")
    });
  }

  /** CSV ile toplu içe aktarma: yalnızca ad ve fiyat zorunlu. */
  static fromImportRow(row, rowNumber, defaults = {}) {
    const data = row || {};
    const name = typeof data.name === "string" ? data.name.trim() : "";
    try {
      return Product.create({
        ...defaults,
        name,
        price: data.price,
        stock: data.stock === undefined || data.stock === "" ? 0 : data.stock,
        sku: data.sku,
        description: isNonEmptyString(data.description) ? data.description : name,
        imageUrl: isNonEmptyString(data.imageUrl) ? data.imageUrl : defaults.imageUrl,
        status: ProductStatus.DRAFT
      });
    } catch (error) {
      throw new ValidationError(`${rowNumber}. satır: ${error.message}`);
    }
  }

  get isPurchasable() {
    return this.status === ProductStatus.ACTIVE && this.stock > 0;
  }
}

module.exports = { Product, ProductStatus, MAX_STOCK, assertImageUrl, assertStock };
