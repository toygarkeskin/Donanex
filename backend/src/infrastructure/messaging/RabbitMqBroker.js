"use strict";

const amqplib = require("amqplib");

const EXCHANGE = "donanex.events";

/**
 * RabbitMQ bağlantısı ve topic exchange.
 *
 * Olaylar doğrudan kuyruğa değil, outbox üzerinden buraya gelir; bu yüzden
 * kuyruk geçici olarak erişilemez olsa bile hiçbir olay kaybolmaz, yalnızca
 * gecikir. Bağlantı koptuğunda kendiliğinden yeniden kurulur.
 */
class RabbitMqBroker {
  constructor(url, logger = console) {
    this.url = url;
    this.logger = logger;
    this.connection = null;
    this.channel = null;
    this.closing = false;
  }

  async connect() {
    if (this.channel) return this.channel;

    this.connection = await amqplib.connect(this.url);
    this.connection.on("error", (error) =>
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
  async publish(type, payload) {
    const channel = await this.connect();
    return channel.publish(EXCHANGE, type, Buffer.from(JSON.stringify(payload)), {
      contentType: "application/json",
      persistent: true,
      timestamp: Date.now(),
      type
    });
  }

  /**
   * @param {string} queue      dayanıklı kuyruk adı
   * @param {string[]} patterns bağlanacak yönlendirme desenleri (ör. "order.*")
   * @param {(message)=>Promise} handler
   */
  async subscribe(queue, patterns, handler) {
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

    await channel.consume(queue, async (message) => {
      if (!message) return;
      try {
        await handler({
          type: message.properties.type || message.fields.routingKey,
          payload: JSON.parse(message.content.toString("utf8"))
        });
        channel.ack(message);
      } catch (error) {
        this.logger.error?.("Kuyruk mesajı işlenemedi: {Reason}", {
          Reason: error.message,
          Queue: queue,
          RoutingKey: message.fields.routingKey
        });
        // requeue=false: mesaj sonsuz döngüye girmesin, ölü mektup kuyruğuna gitsin.
        channel.nack(message, false, false);
      }
    });
  }

  async close() {
    this.closing = true;
    try {
      if (this.channel) await this.channel.close();
      if (this.connection) await this.connection.close();
    } catch {
      /* kapanırken hata önemsiz */
    }
  }
}

module.exports = { RabbitMqBroker, EXCHANGE };
