"use strict";

const { ALL_PERMISSIONS } = require("./Permission");

/**
 * Sistemle birlikte gelen roller. Bunlar silinemez; yeni rol eklenebilir.
 *
 *  SYSTEM_ADMIN  — her şeye yetkili, sistem genelinde
 *  STORE_OWNER   — kendi mağazasının sahibi; yalnızca kendi mağazasında yetkili
 *  STORE_STAFF   — mağaza çalışanı; ürün ve sipariş işler, mağazayı değiştiremez
 *  CUSTOMER      — alışveriş yapan kullanıcı; yönetim izni yoktur
 */
const RoleCodes = Object.freeze({
  SYSTEM_ADMIN: "SYSTEM_ADMIN",
  STORE_OWNER: "STORE_OWNER",
  STORE_STAFF: "STORE_STAFF",
  CUSTOMER: "CUSTOMER"
});

const SYSTEM_ROLES = Object.freeze([
  {
    code: RoleCodes.SYSTEM_ADMIN,
    name: "Sistem Yöneticisi",
    description: "Tüm sistemde sınırsız yetki.",
    scope: "global",
    permissions: ALL_PERMISSIONS
  },
  {
    code: RoleCodes.STORE_OWNER,
    name: "Mağaza Sahibi",
    description: "Kendi mağazasının ürünlerini, siparişlerini ve çalışanlarını yönetir.",
    scope: "store",
    permissions: [
      "catalog:product:read",
      "catalog:product:write",
      "catalog:product:delete",
      "store:read",
      "store:write",
      "store:member:manage",
      "order:read",
      "order:fulfil",
      "order:refund",
      "support:read",
      "support:respond"
    ]
  },
  {
    code: RoleCodes.STORE_STAFF,
    name: "Mağaza Çalışanı",
    description: "Mağazanın ürünlerini ve siparişlerini işler; mağaza ayarlarına dokunamaz.",
    scope: "store",
    permissions: [
      "catalog:product:read",
      "catalog:product:write",
      "store:read",
      "order:read",
      "order:fulfil",
      "support:read",
      "support:respond"
    ]
  },
  {
    code: RoleCodes.CUSTOMER,
    name: "Müşteri",
    description: "Alışveriş yapar; kendi siparişlerini ve bilgilerini görür.",
    scope: "global",
    permissions: []
  }
]);

module.exports = { RoleCodes, SYSTEM_ROLES };
