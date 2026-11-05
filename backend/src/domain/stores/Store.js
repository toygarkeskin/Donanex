"use strict";

const { ConflictError } = require("../shared/errors");
const { requireText, optionalText, requireEmail, slugify, isPhone } = require("../shared/guards");
const { ValidationError } = require("../shared/errors");

const StoreStatus = Object.freeze({
  PENDING: "pending",      // başvuru yapıldı, yönetici onayı bekliyor
  ACTIVE: "active",        // satış yapabilir
  SUSPENDED: "suspended"   // yönetici durdurdu; ürünleri vitrinde görünmez
});

const STORE_TRANSITIONS = Object.freeze({
  [StoreStatus.PENDING]: [StoreStatus.ACTIVE, StoreStatus.SUSPENDED],
  [StoreStatus.ACTIVE]: [StoreStatus.SUSPENDED],
  [StoreStatus.SUSPENDED]: [StoreStatus.ACTIVE]
});

function assertStoreTransition(from, to) {
  if (from === to) return;
  if (!(STORE_TRANSITIONS[from] || []).includes(to)) {
    throw new ConflictError(`Mağaza "${from}" durumundan "${to}" durumuna geçemez.`);
  }
}

/** Mağaza başvurusu. Onaylanana kadar satış yapamaz. */
function createStoreApplication(input) {
  const data = input || {};
  const name = requireText(data.name, "Mağaza adı", 120);
  const slug = slugify(data.slug || name);
  if (slug.length < 3) throw new ValidationError("Mağaza adı en az 3 harf içermeli.");
  if (!isPhone(data.phone)) throw new ValidationError("Telefon numarası geçersiz.");

  return Object.freeze({
    name,
    slug,
    description: requireText(data.description, "Mağaza açıklaması", 2000),
    contactEmail: requireEmail(data.contactEmail, "İletişim e-postası"),
    phone: String(data.phone).trim(),
    taxNumber: optionalText(data.taxNumber, "Vergi numarası", 30),
    status: StoreStatus.PENDING
  });
}

function validateStoreUpdate(input) {
  const data = input || {};
  if (!isPhone(data.phone)) throw new ValidationError("Telefon numarası geçersiz.");
  return Object.freeze({
    name: requireText(data.name, "Mağaza adı", 120),
    description: requireText(data.description, "Mağaza açıklaması", 2000),
    contactEmail: requireEmail(data.contactEmail, "İletişim e-postası"),
    phone: String(data.phone).trim()
  });
}

module.exports = { StoreStatus, createStoreApplication, validateStoreUpdate, assertStoreTransition };
