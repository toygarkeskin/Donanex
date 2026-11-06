"use strict";

const { renderEmail } = require("../infrastructure/mail/templates");

const QUEUE = "donanex.email";
const PATTERNS = ["user.*", "order.*", "store.*", "support.*"];

/**
 * Kuyruktan gelen olayları e-postaya çevirir.
 *
 * E-posta gönderimi isteğin kritik yolundan çıkarılmıştır: müşteri siparişini
 * verdiğinde SMTP'nin yavaşlığı ya da arızası onu bekletmez. Gönderim
 * başarısız olursa mesaj ölü mektup kuyruğuna düşer ve kaybolmaz.
 */
function startEmailConsumer({ broker, mailer, config, logger }) {
  return broker.subscribe(QUEUE, PATTERNS, async ({ type, payload }) => {
    const email = renderEmail(type, payload.payload ?? payload, { publicUrl: config.publicUrl });
    if (!email) return; // Bu olay için e-posta yok.

    const recipient = (payload.payload ?? payload).email;
    if (!recipient) return;

    const sent = await mailer.send({ to: recipient, ...email });
    if (!sent) throw new Error(`E-posta gönderilemedi: ${type}`);

    logger.info("Olay e-postaya dönüştürüldü: {EventType}", { EventType: type, Recipient: recipient });
  });
}

module.exports = { startEmailConsumer, QUEUE };
