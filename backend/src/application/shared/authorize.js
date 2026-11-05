"use strict";

const { ForbiddenError } = require("../../domain/shared/errors");

/**
 * Handler içinde ikinci kat yetki denetimi (defense in depth).
 *
 * Birinci kat rotadadır; buradaki denetim, bir rotanın yanlışlıkla korumasız
 * bırakılması durumunda iş mantığının yine de yetkisiz çağrılmamasını sağlar.
 */
function assertCan(context, permission, scope = {}) {
  const policy = context?.policy;
  if (!policy || typeof policy.can !== "function") {
    throw new ForbiddenError("Bu işlem için yetkiniz yok.");
  }
  if (!policy.can(permission, scope)) {
    throw new ForbiddenError("Bu işlem için yetkiniz yok.");
  }
  return policy;
}

module.exports = { assertCan };
