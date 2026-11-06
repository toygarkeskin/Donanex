"use strict";

import { ConflictError, ValidationError } from "../shared/errors";
import { requireText, optionalText, requireEmail, slugify, isPhone } from "../shared/guards";

export const StoreStatus = {
  PENDING: "pending", // başvuru yapıldı, yönetici onayı bekliyor
  ACTIVE: "active", // satış yapabilir
  SUSPENDED: "suspended" // yönetici durdurdu; ürünleri vitrinde görünmez
} as const;

export type StoreStatusKind = (typeof StoreStatus)[keyof typeof StoreStatus];

const STORE_TRANSITIONS: Readonly<Record<StoreStatusKind, readonly StoreStatusKind[]>> = Object.freeze({
  [StoreStatus.PENDING]: [StoreStatus.ACTIVE, StoreStatus.SUSPENDED],
  [StoreStatus.ACTIVE]: [StoreStatus.SUSPENDED],
  [StoreStatus.SUSPENDED]: [StoreStatus.ACTIVE]
});

export function assertStoreTransition(from: StoreStatusKind, to: StoreStatusKind): void {
  if (from === to) return;
  if (!(STORE_TRANSITIONS[from] ?? []).includes(to)) {
    throw new ConflictError(`Mağaza "${from}" durumundan "${to}" durumuna geçemez.`);
  }
}

export interface StoreApplicationInput {
  name?: unknown;
  slug?: unknown;
  description?: unknown;
  contactEmail?: unknown;
  phone?: unknown;
  taxNumber?: unknown;
}

export interface StoreApplication {
  readonly name: string;
  readonly slug: string;
  readonly description: string;
  readonly contactEmail: string;
  readonly phone: string;
  readonly taxNumber: string | null;
  readonly status: StoreStatusKind;
}

/** Mağaza başvurusu. Onaylanana kadar satış yapamaz. */
export function createStoreApplication(input?: StoreApplicationInput | null): StoreApplication {
  const data = input ?? {};
  const name = requireText(data.name, "Mağaza adı", 120);
  const slug = slugify(data.slug || name);
  if (slug.length < 3) throw new ValidationError("Mağaza adı en az 3 harf içermeli.");
  if (!isPhone(data.phone)) throw new ValidationError("Telefon numarası geçersiz.");

  return Object.freeze({
    name,
    slug,
    description: requireText(data.description, "Mağaza açıklaması", 2000),
    contactEmail: requireEmail(data.contactEmail, "İletişim e-postası"),
    phone: data.phone.trim(),
    taxNumber: optionalText(data.taxNumber, "Vergi numarası", 30),
    status: StoreStatus.PENDING
  });
}

export interface StoreUpdate {
  readonly name: string;
  readonly description: string;
  readonly contactEmail: string;
  readonly phone: string;
}

export function validateStoreUpdate(input?: StoreApplicationInput | null): StoreUpdate {
  const data = input ?? {};
  if (!isPhone(data.phone)) throw new ValidationError("Telefon numarası geçersiz.");
  return Object.freeze({
    name: requireText(data.name, "Mağaza adı", 120),
    description: requireText(data.description, "Mağaza açıklaması", 2000),
    contactEmail: requireEmail(data.contactEmail, "İletişim e-postası"),
    phone: data.phone.trim()
  });
}
