"use strict";

import { Command, type Handler } from "../../shared/cqrs/Message";
import type { UseCaseContext } from "../../shared/authorize";
import type { OpaqueTokens, UnitOfWork } from "../../shared/contracts";

export class SignOutCommand extends Command {
  readonly ssoToken: string | null;
  readonly everywhere: boolean;

  constructor(input?: { ssoToken?: string | null; everywhere?: unknown }) {
    super();
    this.ssoToken = input?.ssoToken ?? null;
    this.everywhere = input?.everywhere === true;
  }
}

export interface SignOutResult {
  readonly signedOut: boolean;
}

/**
 * Çıkış. Oturum sunucu tarafında iptal edilir ve o oturuma bağlı tüm yenileme
 * jetonları geçersiz kılınır; çalınmış bir çerez ya da jeton artık işe yaramaz.
 */
export class SignOutHandler implements Handler<SignOutCommand, SignOutResult, UseCaseContext> {
  private readonly unitOfWork: UnitOfWork;
  private readonly opaqueTokens: OpaqueTokens;

  constructor({ unitOfWork, opaqueTokens }: { unitOfWork: UnitOfWork; opaqueTokens: OpaqueTokens }) {
    this.unitOfWork = unitOfWork;
    this.opaqueTokens = opaqueTokens;
  }

  async handle({ ssoToken, everywhere }: SignOutCommand, context: UseCaseContext = {}): Promise<SignOutResult> {
    if (!ssoToken || !this.opaqueTokens.isWellFormed(ssoToken)) return { signedOut: false };

    return this.unitOfWork.run(async (repos) => {
      const session = await repos.authSessions.findByTokenHash(this.opaqueTokens.hash(ssoToken));
      if (!session) return { signedOut: false };

      if (everywhere) {
        await repos.authSessions.revokeAllForUser(session.userId);
        await repos.oauth.revokeRefreshTokensForUser(session.userId);
      } else {
        await repos.authSessions.revoke(session.id);
        await repos.oauth.revokeRefreshTokensForSession(session.id);
      }

      await repos.audit.record({
        actorId: session.userId,
        action: everywhere ? "user.signed_out_everywhere" : "user.signed_out",
        resourceType: "user",
        resourceId: session.userId,
        context
      });
      return { signedOut: true };
    });
  }
}
