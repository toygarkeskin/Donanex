"use strict";

import type { Logger, Row } from "../application/shared/contracts";
import type { CommandBus } from "../application/shared/cqrs/bus";
import type { UseCaseContext } from "../application/shared/authorize";
import type { BrokerMessage, RabbitMqBroker } from "../infrastructure/messaging/RabbitMqBroker";
import type { RedisNotificationStream, StreamedNotification } from "../infrastructure/notifications/RedisNotificationStream";

import { RecordNotificationsCommand } from "../application/notifications";
import { renderNotifications } from "../infrastructure/notifications/templates";
import { aliciAnahtari } from "../infrastructure/notifications/RedisNotificationStream";

/*
 * KENDİ kuyruğu var, e-posta tüketicisiyle paylaşmıyor.
 *
 * RabbitMQ'da aynı kuyruğu dinleyen iki tüketici mesajları PAYLAŞIR, ikisi de
 * almaz: olayların yarısı e-postaya, yarısı bildirime dönerdi. Ayrı kuyruk
 * (aynı exchange'e aynı desenlerle bağlı) her olayın iki kopyasını üretir ve
 * bir kanalın arızası diğerini durdurmaz — SMTP çökmüşken zil çalışmaya
 * devam eder.
 */
const QUEUE = "donanex.notifications";
const PATTERNS = ["user.*", "order.*", "store.*", "support.*"];

/**
 * Kuyruktan gelen olayları site içi bildirime çevirir.
 *
 * Akış: olay -> metin (templates) -> veritabanı (komut) -> gerçek zamanlı
 * kanal. Son adım YALNIZCA gerçekten yazılan satırlar için çalışır: kuyruk
 * en-az-bir-kez teslim ettiği için aynı olay ikinci kez gelebilir, o durumda
 * komut hiçbir satır yazmaz ve ekranda ikinci bir bildirim de belirmez.
 */
export function startNotificationConsumer({
  broker,
  commands,
  stream,
  logger
}: {
  broker: RabbitMqBroker;
  commands: CommandBus<UseCaseContext>;
  stream: RedisNotificationStream | null;
  logger: Logger;
}): Promise<void> {
  return broker.subscribe(QUEUE, PATTERNS, async ({ type, payload }: BrokerMessage) => {
    // Zarf ile içerik: yayıncı olayı { id, type, aggregateId, payload } olarak
    // sarıyor. Eski biçimde (sarılmamış) gelen bir mesaj da çalışsın diye
    // ikisine de bakılıyor.
    const zarf = payload as Row;
    const govde = (zarf.payload ?? zarf) as Row;

    const drafts = renderNotifications(type, {
      aggregateId: (zarf.aggregateId ?? null) as string | null,
      payload: govde
    });
    if (!drafts.length) return; // Bu olay için bildirim yok.

    const { items } = await commands.execute<{ items: Row[] }>(
      new RecordNotificationsCommand({
        sourceEventId: zarf.id ? String(zarf.id) : null,
        drafts
      })
    );
    if (!items.length) return; // Aynı olay daha önce işlenmiş.

    /*
     * Satırın kendisi liste ucunun döndürdüğüyle AYNI şekilde (alıcı
     * alanları çıkarılıyor), alıcı ise anahtar olarak yanında taşınıyor.
     * Böylece istemci aynı bileşenle çiziyor ama bildirimin hangi kutuya
     * ait olduğunu da biliyor.
     */
    const yayin: StreamedNotification[] = items.map(({ scope, scopeId, ...item }) => ({
      key: aliciAnahtari(String(scope), (scopeId ?? null) as string | null),
      item
    }));
    await stream?.publish(yayin);

    logger.info("{Count} bildirim yazıldı: {EventType}", { Count: items.length, EventType: type });
  });
}

export { QUEUE };
