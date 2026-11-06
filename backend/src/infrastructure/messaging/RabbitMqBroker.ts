"use strict";

import amqplib, { type Channel, type ChannelModel, type ConsumeMessage } from "amqplib";

import type { Logger } from "../../application/shared/contracts";

export const EXCHANGE = "donanex.events";

/** Kuyruktan gelen mesajın tüketiciye verilen hali. */
export interface BrokerMessage {
  readonly type: string;
  readonly payload: unknown;
}

/**
 * RabbitMQ bağlantısı ve topic exchange.
 *
 * Olaylar doğrudan kuyruğa değil, outbox üzerinden buraya gelir; bu yüzden
 * kuyruk geçici olarak erişilemez olsa bile hiçbir olay kaybolmaz, yalnızca
 * gecikir. Bağlantı koptuğunda kendiliğinden yeniden kurulur.
 */
export class RabbitMqBroker {
  private readonly url: string;
  private readonly logger: Partial<Logger>;
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;
  /** Kasıtlı kapanışta yeniden bağlanma denenmesin. */
  private closing = false;

  constructor(url: string, logger: Partial<Logger> = console) {
    this.url = url;
    this.logger = logger;
  }

  async connect(): Promise<Channel> {
    if (this.channel) return this.channel;

    this.connection = await amqplib.connect(this.url);
    this.connection.on("error", (error: Error) =>
      this.logger.warn?.("RabbitMQ bağlantı hatası: {Reason}", { Reason: error.message })
    );
    this.connection.on("close", () => {
      this.channel = null;
      if (!this.closing) setTimeout(() => this.connect().catch(() => {}), 3000);
    });

    this.channel = await this.connection.createChannel();
    await this.channel.assertExchange(EXCHANGE, "topic", { durable: true });
    return this.channel;
  }

  /** Kalıcı (persistent) yayın: broker yeniden başlasa da mesaj durur. */
  async publish(type: string, payload: unknown): Promise<boolean> {
    const channel = await this.connect();
    return channel.publish(EXCHANGE, type, Buffer.from(JSON.stringify(payload)), {
      contentType: "application/json",
      persistent: true,
      timestamp: Date.now(),
      type
    });
  }

  /**
   * @param queue    dayanıklı kuyruk adı
   * @param patterns bağlanacak yönlendirme desenleri (ör. "order.*")
   * @param handler  mesajı işleyen fonksiyon; fırlatırsa mesaj ölü mektup
   *                 kuyruğuna gider, sonsuz döngüye girmez
   */
  async subscribe(
    queue: string,
    patterns: readonly string[],
    handler: (message: BrokerMessage) => Promise<unknown>
  ): Promise<void> {
    const channel = await this.connect();
    await channel.assertQueue(queue, {
      durable: true,
      deadLetterExchange: `${EXCHANGE}.dlx`
    });
    await channel.assertExchange(`${EXCHANGE}.dlx`, "topic", { durable: true });
    await channel.assertQueue(`${queue}.failed`, { durable: true });
    await channel.bindQueue(`${queue}.failed`, `${EXCHANGE}.dlx`, "#");

    for (const pattern of patterns) await channel.bindQueue(queue, EXCHANGE, pattern);
    await channel.prefetch(10);

    await channel.consume(queue, async (message: ConsumeMessage | null) => {
      if (!message) return;
      try {
        await handler({
          type: message.properties.type || message.fields.routingKey,
          payload: JSON.parse(message.content.toString("utf8"))
        });
        channel.ack(message);
      } catch (error) {
        const mesaj = error instanceof Error ? error.message : String(error);
        this.logger.error?.("Kuyruk mesajı işlenemedi: {Reason}", {
          Reason: mesaj,
          Queue: queue,
          RoutingKey: message.fields.routingKey
        });
        // requeue=false: mesaj sonsuz döngüye girmesin, ölü mektup kuyruğuna gitsin.
        channel.nack(message, false, false);
      }
    });
  }

  async close(): Promise<void> {
    this.closing = true;
    try {
      if (this.channel) await this.channel.close();
      if (this.connection) await this.connection.close();
    } catch {
      /* kapanırken hata önemsiz */
    }
  }
}
