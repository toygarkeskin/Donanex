"use strict";

const { Query } = require("../../shared/cqrs/Message");
const { NotFoundError } = require("../../../domain/shared/errors");

class GetAuthorizationRequestQuery extends Query {
  constructor(input) {
    super();
    this.authRequestId = input?.authRequestId;
  }
}

/**
 * Giriş sayfasının bekleyen OAuth isteğini tanıması için.
 *
 * Yalnızca önbelleği okur: gösterilecek bilgiler (istemci adı, izin alanları)
 * isteği oluşturan komut tarafından oraya yazılmıştır. code_challenge gibi
 * gizli alanlar dışarı verilmez.
 */
class GetAuthorizationRequestHandler {
  constructor({ cache }) {
    this.cache = cache;
  }

  async handle({ authRequestId }) {
    const request = await this.cache.get(`authreq:${authRequestId}`);
    if (!request) throw new NotFoundError("Giriş isteğinin süresi dolmuş. Lütfen baştan deneyin.");

    return {
      clientName: request.clientName ?? request.clientId,
      scope: request.scope.split(" ")
    };
  }
}

module.exports = { GetAuthorizationRequestQuery, GetAuthorizationRequestHandler };
