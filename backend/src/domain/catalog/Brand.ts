"use strict";

import { requireText, slugify } from "../shared/guards";

/** Marka oluşturulurken dışarıdan gelen ham girdi. */
export interface BrandInput {
  name?: unknown;
}

export interface Brand {
  readonly name: string;
  readonly slug: string;
}

/**
 * Marka: ürünü KİMİN ürettiği ("Kingston"). Kısa ad (adres) her zaman addan
 * türetiliyor; "Kingston", "KINGSTON" ve "kingston" aynı markadır.
 */
export function createBrand(input?: BrandInput | null): Brand {
  const name = requireText((input ?? {}).name, "Marka adı", 120);
  return Object.freeze({ name, slug: slugify(name) });
}
