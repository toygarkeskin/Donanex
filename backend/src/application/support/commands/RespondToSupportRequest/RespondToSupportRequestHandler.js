"use strict";

const { ValidationError, NotFoundError } = require("../../../../domain/shared/errors");
const { isId } = require("../../../../domain/shared/guards");
const { createSupportResponse } = require("../../../../domain/support/SupportRequest");

class RespondToSupportRequestHandler {
  constructor({ unitOfWork, mailer }) {
    this.unitOfWork = unitOfWork;
    this.mailer = mailer;
  }

  async handle({ id, data }) {
    if (!isId(id)) throw new ValidationError("Geçersiz talep numarası.");
    const { status, response } = createSupportResponse(data);

    const { contact, updated } = await this.unitOfWork.run(async ({ support }) => {
      const found = await support.findContact(Number(id));
      if (!found) throw new NotFoundError("Talep bulunamadı.");
      return { contact: found, updated: await support.respond(Number(id), status, response) };
    });

    // Yalnızca yanıt metni DEĞİŞTİYSE e-posta gider; durum değişikliği müşteriye mail atmaz.
    // E-posta transaction DIŞINDA gönderilir; başarısız olsa da yanıt kaydedilmiş olur.
    const responseChanged = response && response !== contact.adminResponse;
    let emailSent = false;
    if (responseChanged) {
      emailSent = await this.mailer.send({
        to: contact.email,
        subject: "Destek talebinize yanıt verildi",
        text:
          `Merhaba ${contact.fullName},\n\n` +
          `Destek talebinize yanıt verildi:\n\n${response}\n\n` +
          "Bilgisayar Bilgileri Destek Ekibi"
      });
    }

    return { request: updated, emailAttempted: Boolean(responseChanged), emailSent };
  }
}

module.exports = { RespondToSupportRequestHandler };
