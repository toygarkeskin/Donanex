"use strict";

const { UnauthorizedError, ConfigurationError } = require("../../../../domain/shared/errors");
const { ADMIN_SESSION_TTL_MS, TOKEN_TYPES } = require("../../sessionPolicy");

class LoginAdminHandler {
  /**
   * @param adminCredentials { username, password } — ortam değişkenlerinden gelir
   * @param safeEqual  zamanlama saldırısına dayanıklı karşılaştırma
   */
  constructor({ adminCredentials, tokenService, safeEqual }) {
    this.credentials = adminCredentials;
    this.tokenService = tokenService;
    this.safeEqual = safeEqual;
  }

  async handle({ data }) {
    if (!this.credentials.username || !this.credentials.password) {
      throw new ConfigurationError("Yönetici ayarları eksik.");
    }
    const { username, password } = data || {};

    const ok =
      typeof username === "string" &&
      typeof password === "string" &&
      // İki karşılaştırma da her zaman yapılır.
      [
        this.safeEqual(username, this.credentials.username),
        this.safeEqual(password, this.credentials.password)
      ].every(Boolean);

    if (!ok) throw new UnauthorizedError("Kullanıcı adı veya parola hatalı.");

    return {
      token: this.tokenService.issue(
        { typ: TOKEN_TYPES.ADMIN, username: this.credentials.username },
        ADMIN_SESSION_TTL_MS
      ),
      maxAgeSeconds: ADMIN_SESSION_TTL_MS / 1000
    };
  }
}

module.exports = { LoginAdminHandler };
