"use strict";

import { Query, type Handler } from "../../shared/cqrs/Message";
import { NotFoundError } from "../../../domain/shared/errors";
import type { PendingAuthRequest } from "../commands/Authorize";
import type { Cache } from "../../shared/contracts";

export class GetAuthorizationRequestQuery extends Query {
  readonly authRequestId: string;

  constructor(input?: { authRequestId?: string }) {
    super();
    this.authRequestId = input?.authRequestId as string;
  }
}

export interface AuthorizationRequestView {
  readonly clientName: string;
  readonly scope: string[];
}

/**
 * Giriş sayfasının bekleyen OAuth isteğini tanıması için.
 *
 * Yalnızca önbelleği okur: gösterilecek bilgiler (istemci adı, izin alanları)
 * isteği oluşturan komut tarafından oraya yazılmıştır. code_challenge gibi
 * gizli alanlar dışarı verilmez. Sorgu handler'ı unitOfWork kullanmaz —
 * mimari testi bunu zorlar.
 */
export class GetAuthorizationRequestHandler
  implements Handler<GetAuthorizationRequestQuery, AuthorizationRequestView>
{
  private readonly cache: Cache;

  constructor({ cache }: { cache: Cache }) {
    this.cache = cache;
  }

  async handle({ authRequestId }: GetAuthorizationRequestQuery): Promise<AuthorizationRequestView> {
    const request = await this.cache.get<PendingAuthRequest>(`authreq:${authRequestId}`);
    if (!request) throw new NotFoundError("Giriş isteğinin süresi dolmuş. Lütfen baştan deneyin.");

    return {
      clientName: request.clientName ?? request.clientId,
      scope: request.scope.split(" ")
    };
  }
}
