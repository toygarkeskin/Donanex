"use strict";

const { TOKEN_TYPES } = require("../../sessionPolicy");

/** Çerezlerdeki belirteçleri doğrular; imza, süre, kara liste ve oturum sürümüne bakar. */
class ResolveSessionsHandler {
  constructor({ tokenService, sessionReadModel, customerReadModel, adminCredentials, safeEqual }) {
    this.tokenService = tokenService;
    this.sessions = sessionReadModel;
    this.customers = customerReadModel;
    this.adminUsername = adminCredentials.username;
    this.safeEqual = safeEqual;
  }

  async resolveAdmin(token) {
    const payload = this.tokenService.verify(token, TOKEN_TYPES.ADMIN);
    if (!payload || !this.adminUsername || !this.safeEqual(payload.username, this.adminUsername)) return null;
    if (await this.sessions.isRevoked(payload.jti)) return null;
    return { username: payload.username };
  }

  async resolveCustomer(token) {
    const payload = this.tokenService.verify(token, TOKEN_TYPES.CUSTOMER);
    if (!payload || !/^\d+$/.test(String(payload.customerId))) return null;
    if (await this.sessions.isRevoked(payload.jti)) return null;

    const version = await this.customers.getSessionVersion(payload.customerId);
    if (version === null || version !== payload.sv) return null;
    return { customerId: String(payload.customerId) };
  }

  async handle({ adminToken, customerToken }) {
    const [admin, customer] = await Promise.all([
      this.resolveAdmin(adminToken),
      this.resolveCustomer(customerToken)
    ]);
    return { admin, customer };
  }
}

module.exports = { ResolveSessionsHandler };
