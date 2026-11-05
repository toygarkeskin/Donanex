"use strict";

const { Command } = require("../../shared/cqrs/Message");
const { ConflictError } = require("../../../domain/shared/errors");
const { validateRegistration } = require("../../../domain/identity/User");
const { RoleCodes } = require("../../../domain/identity/Role");
const { AccessPolicy } = require("../../../domain/identity/AccessPolicy");
const { EventTypes, domainEvent } = require("../../../domain/shared/DomainEvent");
const { EMAIL_VERIFICATION_TTL_MS } = require("../authPolicy");
const { mergeGuestCart } = require("../services/mergeGuestCart");
const { issueSsoSession } = require("../services/issueSession");

class RegisterUserCommand extends Command {
  /** @param {{data:object, guestCartId?:string|null}} input */
  constructor(input) {
    super();
    this.data = input?.data;
    this.guestCartId = input?.guestCartId ?? null;
  }
}

/**
 * Yeni müşteri kaydı. Kayıt biter bitmez oturum açılır ve misafir sepeti taşınır;
 * kullanıcı "kayıt olarak devam et" dediğinde alışverişini kaldığı yerden sürdürür.
 */
class RegisterUserHandler {
  constructor({ unitOfWork, passwordHasher, opaqueTokens, clock, ids }) {
    this.unitOfWork = unitOfWork;
    this.passwordHasher = passwordHasher;
    this.opaqueTokens = opaqueTokens;
    this.clock = clock;
    this.ids = ids;
  }

  async handle({ data, guestCartId }, context = {}) {
    const registration = validateRegistration(data);
    const passwordHash = await this.passwordHasher.hash(registration.password);
    const verificationToken = this.opaqueTokens.generate();

    return this.unitOfWork.run(async (repos) => {
      const user = await repos.users.createIfEmailFree({
        id: this.ids.uuid(),
        email: registration.email,
        fullName: registration.fullName,
        phone: registration.phone,
        passwordHash
      });
      // Aynı yanıt: var olan e-postayı ConflictError ile bildiriyoruz çünkü
      // kayıt formunda kullanıcının bunu bilmesi gerekiyor (rate limit korur).
      if (!user) throw new ConflictError("Bu e-posta adresi zaten kayıtlı.");

      await repos.roles.assign({ userId: user.id, roleCode: RoleCodes.CUSTOMER, storeId: null });

      await repos.verificationTokens.replace({
        purpose: "email_verification",
        userId: user.id,
        tokenHash: this.opaqueTokens.hash(verificationToken),
        expiresAt: new Date(this.clock.now().getTime() + EMAIL_VERIFICATION_TTL_MS)
      });

      const cart = await mergeGuestCart(repos, { guestCartId, userId: user.id });
      const session = await issueSsoSession(repos, {
        userId: user.id,
        opaqueTokens: this.opaqueTokens,
        clock: this.clock,
        context
      });

      await repos.outbox.add(
        domainEvent(EventTypes.USER_REGISTERED, "user", user.id, {
          email: user.email,
          fullName: user.fullName,
          verificationToken
        })
      );
      await repos.audit.record({
        actorId: user.id,
        action: "user.registered",
        resourceType: "user",
        resourceId: user.id,
        context
      });

      return {
        user: { id: user.id, email: user.email, fullName: user.fullName },
        session,
        policy: new AccessPolicy([{ roleCode: RoleCodes.CUSTOMER, storeId: null, permissions: [] }]).toClaims(),
        mergedCartItems: cart.merged
      };
    });
  }
}

module.exports = { RegisterUserCommand, RegisterUserHandler };
