"use strict";

const { UnauthorizedError } = require("../../../../domain/shared/errors");
const { validateLogin } = require("../../../../domain/customers/Customer");
const { CUSTOMER_SESSION_TTL_MS, REMEMBERED_SESSION_TTL_MS, TOKEN_TYPES } = require("../../../identity/sessionPolicy");

/** Kimlik doğrular ve imzalı oturum belirteci üretir. */
class LoginCustomerHandler {
  constructor({ unitOfWork, passwordHasher, tokenService }) {
    this.unitOfWork = unitOfWork;
    this.passwordHasher = passwordHasher;
    this.tokenService = tokenService;
  }

  async handle({ data }) {
    const { email, password } = validateLogin(data);
    const remember = data?.remember === true;

    const customer = await this.unitOfWork.run(({ customers }) => customers.findCredentialsByEmail(email));

    // Kullanıcı yoksa da aynı işlem yapılır: yanıt süresi kayıtlı e-postaları ele vermez.
    const ok = customer
      ? await this.passwordHasher.verify(password, customer.passwordHash)
      : await this.passwordHasher.verifyDummy(password);
    if (!customer || !ok) throw new UnauthorizedError("E-posta veya şifre hatalı.");

    // Eski biçimde saklanan parola güçlü biçime yükseltilir.
    if (this.passwordHasher.needsRehash(customer.passwordHash)) {
      const upgraded = await this.passwordHasher.hash(password);
      await this.unitOfWork.run(({ customers }) => customers.upgradePasswordHash(customer.id, upgraded));
    }

    const ttlMs = remember ? REMEMBERED_SESSION_TTL_MS : CUSTOMER_SESSION_TTL_MS;
    const token = this.tokenService.issue(
      { typ: TOKEN_TYPES.CUSTOMER, customerId: String(customer.id), sv: customer.sessionVersion },
      ttlMs
    );

    return {
      token,
      // null: tarayıcı kapanınca silinen oturum çerezi
      maxAgeSeconds: remember ? ttlMs / 1000 : null,
      customer: { id: customer.id, name: customer.name, email: customer.email }
    };
  }
}

module.exports = { LoginCustomerHandler };
