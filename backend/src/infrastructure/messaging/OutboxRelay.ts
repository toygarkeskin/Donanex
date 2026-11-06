"use strict";

import type { Logger, UnitOfWork } from "../../application/shared/contracts";

/** Olayı kuyruğa veren taraf; testlerde yerine sahte bir nesne konabilir. */
export interface EventPublisher {
  publish(type: string, payload: unknown): Promise<unknown>;
}

export interface OutboxRelayOptions {
  readonly unitOfWork: UnitOfWork;
  readonly broker: EventPublisher;
  readonly logger: Logger;
  readonly batchSize?: number;
  readonly intervalMs?: number;
}

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
export class OutboxRelay {
  private readonly unitOfWork: UnitOfWork;
  private readonly broker: EventPublisher;
  private readonly logger: Logger;
  private readonly batchSize: number;
  private readonly intervalMs: number;
  private running = false;

  constructor({ unitOfWork, broker, logger, batchSize = 50, intervalMs = 1000 }: OutboxRelayOptions) {
    this.unitOfWork = unitOfWork;
    this.broker = broker;
    this.logger = logger;
    this.batchSize = batchSize;
    this.intervalMs = intervalMs;
  }

  start(): void {
    this.running = true;
    this.loop();
  }

  stop(): void {
    this.running = false;
  }

  async loop(): Promise<void> {
    while (this.running) {
      let published = 0;
      try {
        published = await this.drainOnce();
      } catch (error) {
        const mesaj = error instanceof Error ? error.message : String(error);
        this.logger.error("Outbox aktarımı başarısız: {Reason}", { Reason: mesaj });
      }
      // İş varken hemen devam et, yoksa bekle.
      if (published === 0) await new Promise((resolve) => setTimeout(resolve, this.intervalMs));
    }
  }

  async drainOnce(): Promise<number> {
    return this.unitOfWork.run(async ({ outbox }) => {
      const pending = await outbox.claimPending(this.batchSize);
      if (!pending.length) return 0;

      const delivered: (string | number)[] = [];
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
          const mesaj = error instanceof Error ? error.message : String(error);
          await outbox.markFailed(message.id, mesaj);
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
