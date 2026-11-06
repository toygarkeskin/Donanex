"use strict";

import { Command, type Handler } from "../../shared/cqrs/Message";
import { ConflictError } from "../../../domain/shared/errors";
import { validateRegistration, type RegistrationInput } from "../../../domain/identity/User";
import { RoleCodes } from "../../../domain/identity/Role";
import { AccessPolicy, type RoleClaim } from "../../../domain/identity/AccessPolicy";
import { EventTypes, domainEvent } from "../../../domain/shared/DomainEvent";
import { EMAIL_VERIFICATION_TTL_MS } from "../authPolicy";
import { mergeGuestCart } from "../services/mergeGuestCart";
import { issueSsoSession, type IssuedSsoSession } from "../services/issueSession";
import type { UseCaseContext } from "../../shared/authorize";
import type { Clock, IdGenerator, OpaqueTokens, PasswordHasher, UnitOfWork } from "../../shared/contracts";

export class RegisterUserCommand extends Command {
  readonly data: RegistrationInput | undefined;
  readonly guestCartId: string | null;

  constructor(input?: { data?: RegistrationInput; guestCartId?: string | null }) {
    super();
    this.data = input?.data;
    this.guestCartId = input?.guestCartId ?? null;
  }
}

export interface RegisteredUser {
  readonly user: { id: string; email: string; fullName: string };
  readonly session: IssuedSsoSession;
  readonly policy: readonly RoleClaim[];
  readonly mergedCartItems: number;
}

/**
 * Yeni müşteri kaydı. Kayıt biter bitmez oturum açılır ve misafir sepeti taşınır;
 * kullanıcı "kayıt olarak devam et" dediğinde alışverişini kaldığı yerden sürdürür.
 */
export class RegisterUserHandler implements Handler<RegisterUserCommand, RegisteredUser, UseCaseContext> {
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

  async handle({ data, guestCartId }: RegisterUserCommand, context: UseCaseContext = {}): Promise<RegisteredUser> {
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

      // Olay kendi kendine yeterli: e-posta tüketicisi alıcıyı buradan bulur.
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
