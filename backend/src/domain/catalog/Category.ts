"use strict";

import { requireText, slugify } from "../shared/guards";

/** Kategori oluşturulurken dışarıdan gelen ham girdi. */
export interface CategoryInput {
  name?: unknown;
  slug?: unknown;
  parentId?: string | null;
}

export interface Category {
  readonly name: string;
  readonly slug: string;
  readonly parentId: string | null;
}

export function createCategory(input?: CategoryInput | null): Category {
  const data = input ?? {};
  const name = requireText(data.name, "Kategori adı", 120);
  return Object.freeze({
    name,
    slug: slugify(data.slug || name),
    parentId: data.parentId ?? null
  });
}
