"use strict";

const { Command } = require("../../shared/cqrs/Message");
const { UnauthorizedError, ForbiddenError } = require("../../../domain/shared/errors");
const { UserStatus } = require("../../../domain/identity/User");
const { requireEmail } = require("../../../domain/shared/guards");
const { mergeGuestCart } = require("../services/mergeGuestCart");
const { issueSsoSession } = require("../services/issueSession");

class SignInCommand extends Command {
  constructor(input) {
    super();
    this.email = input?.email;
    this.password = input?.password;
    this.guestCartId = input?.guestCartId ?? null;
  }
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
class SignInHandler {
  constructor({ unitOfWork, passwordHasher, opaqueTokens, clock }) {
    this.unitOfWork = unitOfWork;
    this.passwordHasher = passwordHasher;
    this.opaqueTokens = opaqueTokens;
    this.clock = clock;
  }

  async handle({ email, password, guestCartId }, context = {}) {
    const invalid = () => new UnauthorizedError("E-posta veya parola hatalı.");

    let normalizedEmail;
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

    const ok = user
      ? await this.passwordHasher.verify(password, user.passwordHash)
      : await this.passwordHasher.verifyDummy(password);
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

module.exports = { SignInCommand, SignInHandler };
