"use strict";

const { ForbiddenError } = require("../shared/errors");
const { permissionScope, Scope } = require("./Permission");
const { RoleCodes } = require("./Role");

/**
 * Bir kullanıcının yetkilerini temsil eder ve tek soruyu yanıtlar:
 * "Bu kişi, şu izni, şu kapsamda kullanabilir mi?"
 *
 * Saf bir domain nesnesidir: veritabanı, HTTP ve jeton biçimi bilmez.
 * Rol atamaları ya sistem genelindedir (storeId = null) ya da bir mağazaya bağlıdır.
 */
class AccessPolicy {
  /**
   * @param {Array<{roleCode:string, storeId:string|null, permissions:string[]}>} assignments
   */
  constructor(assignments = []) {
    this.assignments = assignments.map((assignment) => ({
      roleCode: assignment.roleCode,
      storeId: assignment.storeId ?? null,
      permissions: new Set(assignment.permissions || [])
    }));
    Object.freeze(this);
  }

  static empty() {
    return new AccessPolicy([]);
  }

  isSystemAdmin() {
    return this.assignments.some(
      (assignment) => assignment.roleCode === RoleCodes.SYSTEM_ADMIN && assignment.storeId === null
    );
  }

  get roleCodes() {
    return [...new Set(this.assignments.map((assignment) => assignment.roleCode))];
  }

  /** Kişinin herhangi bir mağazada yetkisi var mı? (panel menüsünü göstermek için) */
  get storeIds() {
    return [...new Set(this.assignments.map((a) => a.storeId).filter(Boolean))];
  }

  ownedStoreIds() {
    return this.assignments
      .filter((a) => a.roleCode === RoleCodes.STORE_OWNER && a.storeId)
      .map((a) => a.storeId);
  }

  /**
   * @param {string} permission  izin kodu
   * @param {{storeId?: string|null}} context  mağazaya bağlı izinler için hedef mağaza
   */
  can(permission, context = {}) {
    if (this.isSystemAdmin()) return true;

    const scope = permissionScope(permission);
    if (scope === null) return false;
    // Sistem geneli izinler mağaza rolüyle kazanılamaz.
    if (scope === Scope.GLOBAL) {
      return this.assignments.some((a) => a.storeId === null && a.permissions.has(permission));
    }

    const storeId = context.storeId ?? null;
    return this.assignments.some(
      (assignment) =>
        assignment.permissions.has(permission) &&
        (assignment.storeId === null || assignment.storeId === storeId)
    );
  }

  /** Yetki yoksa hata fırlatır. Rotalarda tek satırda kullanmak için. */
  assert(permission, context = {}) {
    if (!this.can(permission, context)) {
      throw new ForbiddenError("Bu işlem için yetkiniz yok.");
    }
  }

  /** Jetona konacak sade gösterim. */
  toClaims() {
    return this.assignments.map((assignment) => ({
      role: assignment.roleCode,
      store: assignment.storeId
    }));
  }
}

module.exports = { AccessPolicy };
