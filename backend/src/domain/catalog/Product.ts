"use strict";

import { ValidationError } from "../shared/errors";
import { Money } from "../shared/Money";
import { requireText, optionalText, requireEnum, slugify, isNonEmptyString } from "../shared/guards";

export const ProductStatus = {
  DRAFT: "draft", // yalnızca mağaza görür
  ACTIVE: "active", // vitrinde
  ARCHIVED: "archived" // satıştan kaldırıldı, geçmiş siparişler korunur
} as const;

export type ProductStatusKind = (typeof ProductStatus)[keyof typeof ProductStatus];

export const MAX_STOCK = 1_000_000;

/**
 * Ürün görseli yalnızca sitenin kendi dosyalarından ya da HTTPS adresinden gelebilir.
 * javascript:, data: ve http: adresleri reddedilir.
 */
export function assertImageUrl(value: unknown): string {
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

/** Kapak dışında en fazla kaç görsel tutulabilir. */
export const MAX_GALLERY = 5;

/**
 * Ek ürün görselleri.
 *
 * Kapak (imageUrl) hâlâ zorunlu ve ayrı; bu liste onun YANINDAKİ görseller.
 * Her adres kapakla aynı kurallardan geçer, tekrarlar atılır ve sayı
 * sınırlanır: istemci yüz tane adres gönderip ürün sayfasını şişiremesin.
 */
export function assertGalleryUrls(value: unknown): readonly string[] {
  if (value === undefined || value === null) return Object.freeze([]);
  if (!Array.isArray(value)) throw new ValidationError("Ek görseller bir liste olmalı.");
  if (value.length > MAX_GALLERY) {
    throw new ValidationError(`En fazla ${MAX_GALLERY} ek görsel eklenebilir.`);
  }
  const temiz = value.filter((adres) => isNonEmptyString(adres)).map((adres) => assertImageUrl(adres));
  return Object.freeze([...new Set(temiz)]);
}

export function assertStock(value: unknown): number {
  const stock = typeof value === "string" && /^\d+$/.test(value.trim()) ? Number(value) : value;
  if (!Number.isInteger(stock) || (stock as number) < 0 || (stock as number) > MAX_STOCK) {
    throw new ValidationError(`Stok 0 ile ${MAX_STOCK} arasında bir tam sayı olmalı.`);
  }
  return stock as number;
}

/** Ürün alanları — veritabanı satırının domain karşılığı. */
export interface ProductFields {
  readonly id: string | null;
  readonly storeId: string | null;
  readonly categoryId: string | null;
  readonly brandId: string | null;
  readonly name: string;
  readonly slug: string;
  readonly sku: string | null;
  readonly description: string;
  readonly price: Money;
  readonly stock: number;
  readonly imageUrl: string;
  /** Kapağın yanındaki ek görseller; her zaman liste, hiçbir zaman null. */
  readonly galleryUrls: readonly string[];
  readonly status: ProductStatusKind;
}

/** Product.create() girdisi: istemciden gelir, hiçbir alanına güvenilmez. */
export interface ProductInput {
  id?: string | null;
  storeId?: string | null;
  categoryId?: string | null;
  brandId?: string | null;
  name?: unknown;
  slug?: unknown;
  sku?: unknown;
  description?: unknown;
  price?: unknown;
  stock?: unknown;
  imageUrl?: unknown;
  galleryUrls?: unknown;
  status?: unknown;
}

/** CSV satırı: yalnızca ad ve fiyat zorunlu, gerisi isteğe bağlı. */
export interface ImportRow {
  name?: unknown;
  price?: unknown;
  stock?: unknown;
  sku?: unknown;
  description?: unknown;
  imageUrl?: unknown;
  /**
   * Kategori adı ya da slug'ı. Kimliğe çevirmek domain'in işi değil —
   * katalogda hangi kategorilerin bulunduğunu bilmek veri erişimi gerektirir,
   * bu yüzden çözümleme handler'da yapılır.
   */
  category?: unknown;
}

export interface ImportDefaults {
  storeId?: string | null;
  imageUrl?: string;
}

/**
 * Ürün varlığı. Fiyat her zaman Money'dir; vitrin ve sipariş aynı değeri kullanır.
 */
export class Product implements ProductFields {
  readonly id: string | null;
  readonly storeId: string | null;
  readonly categoryId: string | null;
  readonly brandId: string | null;
  readonly name: string;
  readonly slug: string;
  readonly sku: string | null;
  readonly description: string;
  readonly price: Money;
  readonly stock: number;
  readonly imageUrl: string;
  readonly galleryUrls: readonly string[];
  readonly status: ProductStatusKind;

  constructor(fields: ProductFields) {
    this.id = fields.id;
    this.storeId = fields.storeId;
    this.categoryId = fields.categoryId;
    this.brandId = fields.brandId;
    this.name = fields.name;
    this.slug = fields.slug;
    this.sku = fields.sku;
    this.description = fields.description;
    this.price = fields.price;
    this.stock = fields.stock;
    this.imageUrl = fields.imageUrl;
    this.galleryUrls = fields.galleryUrls;
    this.status = fields.status;
    Object.freeze(this);
  }

  static create(input?: ProductInput | null): Product {
    const data = input ?? {};
    const name = requireText(data.name, "Ürün adı", 250);

    return new Product({
      id: data.id ?? null,
      storeId: data.storeId ?? null,
      categoryId: data.categoryId ?? null,
      brandId: data.brandId ?? null,
      name,
      slug: slugify(data.slug || name),
      sku: optionalText(data.sku, "Stok kodu", 60),
      description: requireText(data.description, "Ürün açıklaması", 5000),
      price: Money.fromAmount(data.price, "Fiyat"),
      stock: assertStock(data.stock),
      imageUrl: assertImageUrl(data.imageUrl),
      galleryUrls: assertGalleryUrls(data.galleryUrls),
      status: requireEnum(
        data.status ?? ProductStatus.ACTIVE,
        Object.values(ProductStatus) as ProductStatusKind[],
        "Ürün durumu"
      )
    });
  }

  /** CSV ile toplu içe aktarma: yalnızca ad ve fiyat zorunlu. */
  static fromImportRow(row: ImportRow | null | undefined, rowNumber: number, defaults: ImportDefaults = {}): Product {
    const data = row ?? {};
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
      // Hangi satırın neden reddedildiği kullanıcıya gösterilir.
      const mesaj = error instanceof Error ? error.message : String(error);
      throw new ValidationError(`${rowNumber}. satır: ${mesaj}`);
    }
  }

  get isPurchasable(): boolean {
    return this.status === ProductStatus.ACTIVE && this.stock > 0;
  }
}
