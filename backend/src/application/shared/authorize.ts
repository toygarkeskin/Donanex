"use strict";

import { ForbiddenError } from "../../domain/shared/errors";
import type { AccessContext, AccessPolicy } from "../../domain/identity/AccessPolicy";
import type { PermissionCode } from "../../domain/identity/Permission";

/** Handler'lara geçirilen istek bağlamı. */
export interface UseCaseContext {
  readonly policy?: AccessPolicy | null;
  readonly actorId?: string | null;
  readonly [key: string]: unknown;
}

/**
 * Handler içinde ikinci kat yetki denetimi (defense in depth).
 *
 * Birinci kat rotadadır; buradaki denetim, bir rotanın yanlışlıkla korumasız
 * bırakılması durumunda iş mantığının yine de yetkisiz çağrılmamasını sağlar.
 */
export function assertCan(
  context: UseCaseContext | null | undefined,
  permission: PermissionCode | string,
  scope: AccessContext = {}
): AccessPolicy {
  const policy = context?.policy;
  if (!policy || typeof policy.can !== "function") {
    throw new ForbiddenError("Bu işlem için yetkiniz yok.");
  }
  if (!policy.can(permission, scope)) {
    throw new ForbiddenError("Bu işlem için yetkiniz yok.");
  }
  return policy;
}
