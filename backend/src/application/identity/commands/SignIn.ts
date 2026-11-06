"use strict";

import { Command, type Handler } from "../../shared/cqrs/Message";
import { UnauthorizedError, ForbiddenError } from "../../../domain/shared/errors";
import { UserStatus } from "../../../domain/identity/User";
import { requireEmail } from "../../../domain/shared/guards";
import { mergeGuestCart } from "../services/mergeGuestCart";
import { issueSsoSession, type IssuedSsoSession } from "../services/issueSession";
import type { UseCaseContext } from "../../shared/authorize";
import type { Clock, OpaqueTokens, PasswordHasher, UnitOfWork } from "../../shared/contracts";

export class SignInCommand extends Command {
  readonly email: unknown;
  readonly password: unknown;
  readonly guestCartId: string | null;

  constructor(input?: { email?: unknown; password?: unknown; guestCartId?: string | null }) {
    super();
    this.email = input?.email;
    this.password = input?.password;
    this.guestCartId = input?.guestCartId ?? null;
  }
}

export interface SignedIn {
  readonly user: { id: string; email: string; fullName: string };
  readonly session: IssuedSsoSession;
  readonly mergedCartItems: number;
}

/**
 * Kimlik doğrular ve tarayıcı oturumu açar.
 *
 * Güvenlik notları:
 *  - Kullanıcı bulunamasa bile aynı süre harcanır (verifyDummy); yanıt süresinden
 *    hangi e-postaların kayıtlı olduğu anlaşılamaz.
 *  - Hatalı e-posta ve hatalı parola AYNI mesajı döndürür.
 *  - Parola eski bir biçimde saklanıyorsa sessizce güncel biçime yükseltilir.
 */
export class SignInHandler implements Handler<SignInCommand, SignedIn, UseCaseContext> {
  private readonly unitOfWork: UnitOfWork;
  private readonly passwordHasher: PasswordHasher;
  private readonly opaqueTokens: OpaqueTokens;
  private readonly clock: Clock;

  constructor({
    unitOfWork,
    passwordHasher,
    opaqueTokens,
    clock
  }: {
    unitOfWork: UnitOfWork;
    passwordHasher: PasswordHasher;
    opaqueTokens: OpaqueTokens;
    clock: Clock;
  }) {
    this.unitOfWork = unitOfWork;
    this.passwordHasher = passwordHasher;
    this.opaqueTokens = opaqueTokens;
    this.clock = clock;
  }

  async handle({ email, password, guestCartId }: SignInCommand, context: UseCaseContext = {}): Promise<SignedIn> {
    const invalid = () => new UnauthorizedError("E-posta veya parola hatalı.");

    let normalizedEmail: string;
    try {
      normalizedEmail = requireEmail(email);
    } catch {
      await this.passwordHasher.verifyDummy(String(password ?? ""));
      throw invalid();
    }
    if (typeof password !== "string" || password.length > 200) {
      await this.passwordHasher.verifyDummy("");
      throw invalid();
    }

    const user = await this.unitOfWork.run(({ users }) => users.findCredentialsByEmail(normalizedEmail));

    const ok = user ? await this.passwordHasher.verify(password, user.passwordHash) : await this.passwordHasher.verifyDummy(password);
    if (!user || !ok) throw invalid();

    if (user.status === UserStatus.SUSPENDED) {
      throw new ForbiddenError("Hesabınız askıya alınmış. Destek ekibiyle iletişime geçin.");
    }

    return this.unitOfWork.run(async (repos) => {
      if (this.passwordHasher.needsRehash(user.passwordHash)) {
        await repos.users.updatePasswordHash(user.id, await this.passwordHasher.hash(password));
      }

      const cart = await mergeGuestCart(repos, { guestCartId, userId: user.id });
      const session = await issueSsoSession(repos, {
        userId: user.id,
        opaqueTokens: this.opaqueTokens,
        clock: this.clock,
        context
      });
      await repos.users.touchLastLogin(user.id);
      await repos.audit.record({
        actorId: user.id,
        action: "user.signed_in",
        resourceType: "user",
        resourceId: user.id,
        context
      });

      return {
        user: { id: user.id, email: user.email, fullName: user.fullName },
        session,
        mergedCartItems: cart.merged
      };
    });
  }
}
