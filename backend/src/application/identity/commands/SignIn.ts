"use strict";

import { Command, type Handler } from "../../shared/cqrs/Message";
import { UnauthorizedError, ForbiddenError } from "../../../domain/shared/errors";
import { UserStatus } from "../../../domain/identity/User";
import { requireEmail } from "../../../domain/shared/guards";
import { finishSignIn, maskEmail, sendLoginCode, type SignedIn } from "../services/loginCode";
import type { UseCaseContext } from "../../shared/authorize";
import type { Clock, IdGenerator, OpaqueTokens, PasswordHasher, UnitOfWork } from "../../shared/contracts";

export class SignInCommand extends Command {
  readonly email: unknown;
  readonly password: unknown;
  readonly guestCartId: string | null;
  /** Tarayıcının "bu cihazı hatırla" çerezi; yoksa null. */
  readonly trustedDeviceToken: string | null;

  constructor(input?: {
    email?: unknown;
    password?: unknown;
    guestCartId?: string | null;
    trustedDeviceToken?: string | null;
  }) {
    super();
    this.email = input?.email;
    this.password = input?.password;
    this.guestCartId = input?.guestCartId ?? null;
    this.trustedDeviceToken = input?.trustedDeviceToken ?? null;
  }
}

export type { SignedIn };

/** Parola doğru; oturum e-postadaki kod girilince açılacak. */
export interface SignInCodeRequired {
  readonly verificationRequired: true;
  readonly challengeId: string;
  readonly maskedEmail: string;
}

/**
 * Parolayı doğrular; oturumu açmadan önce e-postaya kod gönderir.
 *
 * Güvenlik notları:
 *  - Kullanıcı bulunamasa bile aynı süre harcanır (verifyDummy); yanıt süresinden
 *    hangi e-postaların kayıtlı olduğu anlaşılamaz.
 *  - Hatalı e-posta ve hatalı parola AYNI mesajı döndürür.
 *  - Parola eski bir biçimde saklanıyorsa sessizce güncel biçime yükseltilir.
 *  - Kod adımı ancak parola DOĞRUYSA başlar: kod e-postası, parolayı bilmeyen
 *    birinin başkasının kutusunu doldurmasına yaramaz.
 *  - "Bu cihazı hatırla" çerezi yalnızca AYNI kullanıcı için geçer.
 */
export class SignInHandler implements Handler<SignInCommand, SignedIn | SignInCodeRequired, UseCaseContext> {
  private readonly unitOfWork: UnitOfWork;
  private readonly passwordHasher: PasswordHasher;
  private readonly opaqueTokens: OpaqueTokens;
  private readonly clock: Clock;
  private readonly ids: IdGenerator;

  constructor({
    unitOfWork,
    passwordHasher,
    opaqueTokens,
    clock,
    ids
  }: {
    unitOfWork: UnitOfWork;
    passwordHasher: PasswordHasher;
    opaqueTokens: OpaqueTokens;
    clock: Clock;
    ids: IdGenerator;
  }) {
    this.unitOfWork = unitOfWork;
    this.passwordHasher = passwordHasher;
    this.opaqueTokens = opaqueTokens;
    this.clock = clock;
    this.ids = ids;
  }

  async handle(
    { email, password, guestCartId, trustedDeviceToken }: SignInCommand,
    context: UseCaseContext = {}
  ): Promise<SignedIn | SignInCodeRequired> {
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

    const kimlik = { id: user.id, email: user.email, fullName: user.fullName };

    return this.unitOfWork.run(async (repos) => {
      if (this.passwordHasher.needsRehash(user.passwordHash)) {
        await repos.users.updatePasswordHash(user.id, await this.passwordHasher.hash(password));
      }

      const guvenilir =
        this.opaqueTokens.isWellFormed(trustedDeviceToken) &&
        (await repos.loginChallenges.isTrustedDevice(user.id, this.opaqueTokens.hash(trustedDeviceToken), this.clock.now()));

      if (guvenilir) {
        return finishSignIn(repos, {
          user: kimlik,
          guestCartId,
          opaqueTokens: this.opaqueTokens,
          clock: this.clock,
          context,
          method: "guvenilen_cihaz"
        });
      }

      const challengeId = this.ids.uuid();
      await sendLoginCode(repos, { challengeId, user: kimlik, opaqueTokens: this.opaqueTokens, clock: this.clock });
      await repos.audit.record({
        actorId: user.id,
        action: "user.login_code_sent",
        resourceType: "user",
        resourceId: user.id,
        context
      });

      return { verificationRequired: true as const, challengeId, maskedEmail: maskEmail(user.email) };
    });
  }
}
