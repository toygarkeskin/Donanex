"use strict";

const { isEmail } = require("../../../../domain/shared/guards");
const { normalizeEmail } = require("../../../../domain/customers/Customer");
const { PASSWORD_RESET_TTL_MS } = require("../../../identity/sessionPolicy");

/**
 * Tek kullanımlık sıfırlama bağlantısı gönderir; veritabanında yalnızca özeti tutulur.
 * Bağlantı "#" sonrasında taşınır: belirteç sunucu günlüklerine ve Referer'a düşmez.
 * Çağıran yanıtı bu işlemi beklemeden döner, böylece kayıtlı e-postalar ele verilmez.
 */
class RequestPasswordResetHandler {
  constructor({ unitOfWork, opaqueTokens, mailer, publicUrl }) {
    this.unitOfWork = unitOfWork;
    this.opaqueTokens = opaqueTokens;
    this.mailer = mailer;
    this.publicUrl = publicUrl;
  }

  async handle({ email }) {
    if (!isEmail(email)) return;

    const token = this.opaqueTokens.generate();
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);

    const customer = await this.unitOfWork.run(async ({ customers }) => {
      const found = await customers.findCredentialsByEmail(normalizeEmail(email));
      if (found) await customers.replaceResetToken(found.id, this.opaqueTokens.hash(token), expiresAt);
      return found;
    });
    if (!customer) return;

    await this.mailer.send({
      to: customer.email,
      subject: "Parola sıfırlama isteği",
      text:
        `Merhaba ${customer.name},\n\n` +
        "Parolanı sıfırlamak için aşağıdaki bağlantıyı 30 dakika içinde aç:\n\n" +
        `${this.publicUrl}/parolaunut.html#token=${token}\n\n` +
        "Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin.\n\n" +
        "Bilgisayar Bilgileri"
    });
  }
}

module.exports = { RequestPasswordResetHandler };
