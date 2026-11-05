"use strict";

/**
 * Transactional outbox'ın yayın tarafı.
 *
 * İş transaction'ı olayı outbox tablosuna yazar; bu döngü de onu RabbitMQ'ya
 * aktarır. Böylece "veritabanına yazdım ama kuyruğa atamadım" (ya da tersi)
 * durumu oluşmaz — iki sistem arasında en-az-bir-kez teslim garantisi sağlanır.
 *
 * Kayıtlar SKIP LOCKED ile kilitlenir; birden çok worker çalışsa bile aynı
 * olay iki kez yayınlanmaz.
 */
class OutboxRelay {
  constructor({ unitOfWork, broker, logger, batchSize = 50, intervalMs = 1000 }) {
    this.unitOfWork = unitOfWork;
    this.broker = broker;
    this.logger = logger;
    this.batchSize = batchSize;
    this.intervalMs = intervalMs;
    this.running = false;
  }

  start() {
    this.running = true;
    this.loop();
  }

  stop() {
    this.running = false;
  }

  async loop() {
    while (this.running) {
      let published = 0;
      try {
        published = await this.drainOnce();
      } catch (error) {
        this.logger.error("Outbox aktarımı başarısız: {Reason}", { Reason: error.message });
      }
      // İş varken hemen devam et, yoksa bekle.
      if (published === 0) await new Promise((resolve) => setTimeout(resolve, this.intervalMs));
    }
  }

  async drainOnce() {
    return this.unitOfWork.run(async ({ outbox }) => {
      const pending = await outbox.claimPending(this.batchSize);
      if (!pending.length) return 0;

      const delivered = [];
      for (const message of pending) {
        try {
          await this.broker.publish(message.type, {
            id: String(message.id),
            type: message.type,
            aggregateType: message.aggregateType,
            aggregateId: message.aggregateId,
            occurredAt: message.occurredAt,
            payload: message.payload
          });
          delivered.push(message.id);
        } catch (error) {
          await outbox.markFailed(message.id, error.message);
        }
      }

      await outbox.markPublished(delivered);
      if (delivered.length) {
        this.logger.debug("{Count} olay kuyruğa aktarıldı", { Count: delivered.length });
      }
      return delivered.length;
    });
  }
}

module.exports = { OutboxRelay };
