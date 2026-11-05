"use strict";

/**
 * İzin kataloğu. Kod biçimi: <alan>:<kaynak>:<eylem>
 *
 * "scope" bir iznin nerede geçerli olabileceğini söyler:
 *   global → yalnızca sistem genelinde verilir (ör. başka mağazaları onaylamak)
 *   store  → bir mağazaya bağlı olarak verilir (ör. kendi ürününü düzenlemek)
 *   both   → her iki şekilde de verilebilir
 */
const Scope = Object.freeze({ GLOBAL: "global", STORE: "store", BOTH: "both" });

const PERMISSIONS = Object.freeze({
  "catalog:product:read": { scope: Scope.BOTH, label: "Ürünleri görüntüle" },
  "catalog:product:write": { scope: Scope.BOTH, label: "Ürün ekle ve düzenle" },
  "catalog:product:delete": { scope: Scope.BOTH, label: "Ürün sil" },
  "catalog:category:manage": { scope: Scope.GLOBAL, label: "Kategorileri yönet" },

  "store:read": { scope: Scope.BOTH, label: "Mağaza bilgilerini görüntüle" },
  "store:write": { scope: Scope.BOTH, label: "Mağaza bilgilerini düzenle" },
  "store:approve": { scope: Scope.GLOBAL, label: "Mağaza başvurusunu onayla veya askıya al" },
  "store:member:manage": { scope: Scope.BOTH, label: "Mağaza çalışanlarını yönet" },

  "order:read": { scope: Scope.BOTH, label: "Siparişleri görüntüle" },
  "order:fulfil": { scope: Scope.BOTH, label: "Sipariş durumunu ve kargoyu güncelle" },
  "order:refund": { scope: Scope.BOTH, label: "İade işle" },

  "support:read": { scope: Scope.BOTH, label: "Destek taleplerini görüntüle" },
  "support:respond": { scope: Scope.BOTH, label: "Destek talebini yanıtla" },

  "user:read": { scope: Scope.GLOBAL, label: "Kullanıcıları görüntüle" },
  "user:write": { scope: Scope.GLOBAL, label: "Kullanıcıları düzenle veya askıya al" },
  "role:assign": { scope: Scope.GLOBAL, label: "Rol ata" },
  "system:audit": { scope: Scope.GLOBAL, label: "Denetim kaydını görüntüle" },
  "system:settings": { scope: Scope.GLOBAL, label: "Sistem ayarlarını yönet" }
});

const ALL_PERMISSIONS = Object.freeze(Object.keys(PERMISSIONS));

const isPermission = (code) => Object.hasOwn(PERMISSIONS, code);
const permissionScope = (code) => PERMISSIONS[code]?.scope ?? null;

module.exports = { PERMISSIONS, ALL_PERMISSIONS, Scope, isPermission, permissionScope };
