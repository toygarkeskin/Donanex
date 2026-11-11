"use strict";

/**
 * İzin kataloğu. Kod biçimi: <alan>:<kaynak>:<eylem>
 *
 * "scope" bir iznin nerede geçerli olabileceğini söyler:
 *   global → yalnızca sistem genelinde verilir (ör. başka mağazaları onaylamak)
 *   store  → bir mağazaya bağlı olarak verilir (ör. kendi ürününü düzenlemek)
 *   both   → her iki şekilde de verilebilir
 */
export const Scope = { GLOBAL: "global", STORE: "store", BOTH: "both" } as const;

export type ScopeKind = (typeof Scope)[keyof typeof Scope];

interface PermissionInfo {
  readonly scope: ScopeKind;
  readonly label: string;
}

export const PERMISSIONS = {
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

  /*
   * Panel bildirimleri. Kişinin KENDİ bildirimleri bu izne tabi değildir —
   * onların kapsamı jetondaki kullanıcı numarasıdır, sorulacak bir şey yok.
   * Bu izin "başkası adına bir kutuyu okumak" içindir: mağazanın ya da
   * yönetimin bildirim kutusu.
   */
  "notification:read": { scope: Scope.BOTH, label: "Panel bildirimlerini görüntüle" },

  "user:read": { scope: Scope.GLOBAL, label: "Kullanıcıları görüntüle" },
  "user:write": { scope: Scope.GLOBAL, label: "Kullanıcıları düzenle veya askıya al" },
  "role:assign": { scope: Scope.GLOBAL, label: "Rol ata" },
  "system:audit": { scope: Scope.GLOBAL, label: "Denetim kaydını görüntüle" },
  "system:settings": { scope: Scope.GLOBAL, label: "Sistem ayarlarını yönet" }
} as const satisfies Record<string, PermissionInfo>;

/**
 * Geçerli izin kodlarının tipi.
 *
 * Bunun değeri şurada: assertCan(context, "catalog:product:writ") gibi bir
 * yazım hatası artık çalışma zamanında sessizce "izin yok" demek yerine
 * derlemede hata verir.
 */
export type PermissionCode = keyof typeof PERMISSIONS;

export const ALL_PERMISSIONS = Object.freeze(Object.keys(PERMISSIONS) as PermissionCode[]);

export const isPermission = (code: unknown): code is PermissionCode =>
  typeof code === "string" && Object.hasOwn(PERMISSIONS, code);

export const permissionScope = (code: string): ScopeKind | null =>
  isPermission(code) ? PERMISSIONS[code].scope : null;
