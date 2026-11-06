"use strict";

import { ForbiddenError } from "../shared/errors";
import { permissionScope, Scope, type PermissionCode } from "./Permission";
import { RoleCodes, type RoleCode } from "./Role";

/** Veritabanından okunan ham rol ataması. */
export interface RoleAssignment {
  readonly roleCode: RoleCode | string;
  readonly storeId?: string | null;
  readonly permissions?: readonly string[];
}

interface ResolvedAssignment {
  readonly roleCode: RoleCode | string;
  readonly storeId: string | null;
  readonly permissions: ReadonlySet<string>;
}

/** Mağazaya bağlı izinler sorulurken verilen hedef. */
export interface AccessContext {
  storeId?: string | null;
}

/** Jetona konan sade rol gösterimi. */
export interface RoleClaim {
  readonly role: RoleCode | string;
  readonly store: string | null;
}

/**
 * Bir kullanıcının yetkilerini temsil eder ve tek soruyu yanıtlar:
 * "Bu kişi, şu izni, şu kapsamda kullanabilir mi?"
 *
 * Saf bir domain nesnesidir: veritabanı, HTTP ve jeton biçimi bilmez.
 * Rol atamaları ya sistem genelindedir (storeId = null) ya da bir mağazaya bağlıdır.
 */
export class AccessPolicy {
  readonly assignments: readonly ResolvedAssignment[];

  constructor(assignments: readonly RoleAssignment[] = []) {
    this.assignments = assignments.map((assignment) => ({
      roleCode: assignment.roleCode,
      storeId: assignment.storeId ?? null,
      permissions: new Set(assignment.permissions ?? [])
    }));
    Object.freeze(this);
  }

  static empty(): AccessPolicy {
    return new AccessPolicy([]);
  }

  isSystemAdmin(): boolean {
    return this.assignments.some(
      (assignment) => assignment.roleCode === RoleCodes.SYSTEM_ADMIN && assignment.storeId === null
    );
  }

  get roleCodes(): string[] {
    return [...new Set(this.assignments.map((assignment) => assignment.roleCode))];
  }

  /** Kişinin herhangi bir mağazada yetkisi var mı? (panel menüsünü göstermek için) */
  get storeIds(): string[] {
    return [...new Set(this.assignments.map((a) => a.storeId).filter((id): id is string => Boolean(id)))];
  }

  ownedStoreIds(): string[] {
    return this.assignments
      .filter((a) => a.roleCode === RoleCodes.STORE_OWNER && a.storeId)
      .map((a) => a.storeId as string);
  }

  can(permission: PermissionCode | string, context: AccessContext = {}): boolean {
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
        assignment.permissions.has(permission) && (assignment.storeId === null || assignment.storeId === storeId)
    );
  }

  /** Yetki yoksa hata fırlatır. Rotalarda tek satırda kullanmak için. */
  assert(permission: PermissionCode | string, context: AccessContext = {}): void {
    if (!this.can(permission, context)) {
      throw new ForbiddenError("Bu işlem için yetkiniz yok.");
    }
  }

  /** Jetona konacak sade gösterim. */
  toClaims(): RoleClaim[] {
    return this.assignments.map((assignment) => ({
      role: assignment.roleCode,
      store: assignment.storeId
    }));
  }
}
