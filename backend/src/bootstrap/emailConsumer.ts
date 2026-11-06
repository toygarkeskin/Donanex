"use strict";

import type { Logger, Row, Services } from "../application/shared/contracts";
import type { AppConfig } from "../config/env";
import type { BrokerMessage, RabbitMqBroker } from "../infrastructure/messaging/RabbitMqBroker";

import { renderEmail } from "../infrastructure/mail/templates";

const QUEUE = "donanex.email";
const PATTERNS = ["user.*", "order.*", "store.*", "support.*"];

/**
 * Kuyruktan gelen olayları e-postaya çevirir.
 *
 * E-posta gönderimi isteğin kritik yolundan çıkarılmıştır: müşteri siparişini
 * verdiğinde SMTP'nin yavaşlığı ya da arızası onu bekletmez. Gönderim
 * başarısız olursa mesaj ölü mektup kuyruğuna düşer ve kaybolmaz.
 */
export function startEmailConsumer({
  broker,
  mailer,
  config,
  logger
}: {
  broker: RabbitMqBroker;
  mailer: Services["mailer"];
  config: AppConfig;
  logger: Logger;
}): Promise<void> {
  return broker.subscribe(QUEUE, PATTERNS, async ({ type, payload }: BrokerMessage) => {
    const govde = payload as Row;
    const email = renderEmail(type, govde.payload ?? govde, { publicUrl: config.publicUrl });
    if (!email) return; // Bu olay için e-posta yok.

    const recipient = (govde.payload ?? govde).email as string | undefined;
    if (!recipient) return;

    const sent = await mailer.send({ to: recipient, ...email });
    if (!sent) throw new Error(`E-posta gönderilemedi: ${type}`);

    logger.info("Olay e-postaya dönüştürüldü: {EventType}", { EventType: type, Recipient: recipient });
  });
}

export { QUEUE };
