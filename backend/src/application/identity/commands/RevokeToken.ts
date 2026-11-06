"use strict";

import { Command, type Handler } from "../../shared/cqrs/Message";
import type { OpaqueTokens, UnitOfWork } from "../../shared/contracts";

export class RevokeTokenCommand extends Command {
  readonly token: unknown;

  constructor(input?: { token?: unknown }) {
    super();
    this.token = input?.token;
  }
}

export interface RevokeResult {
  readonly revoked: boolean;
}

/**
 * RFC 7009 jeton iptali. Spesifikasyon gereği geçersiz jeton için de
 * başarı döner; aksi halde bu uç jeton geçerliliğini sınamak için kullanılabilirdi.
 */
export class RevokeTokenHandler implements Handler<RevokeTokenCommand, RevokeResult> {
  private readonly unitOfWork: UnitOfWork;
  private readonly opaqueTokens: OpaqueTokens;

  constructor({ unitOfWork, opaqueTokens }: { unitOfWork: UnitOfWork; opaqueTokens: OpaqueTokens }) {
    this.unitOfWork = unitOfWork;
    this.opaqueTokens = opaqueTokens;
  }

  async handle({ token }: RevokeTokenCommand): Promise<RevokeResult> {
    if (!this.opaqueTokens.isWellFormed(token)) return { revoked: false };

    return this.unitOfWork.run(async ({ oauth }) => {
      const stored = await oauth.findRefreshTokenByHash(this.opaqueTokens.hash(token as string));
      // Tek jeton değil, tüm aile iptal edilir.
      if (stored) await oauth.revokeRefreshTokenFamily(stored.familyId);
      return { revoked: Boolean(stored) };
    });
  }
}
