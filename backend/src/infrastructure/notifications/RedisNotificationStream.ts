"use strict";

import type { RedisClientType } from "redis";

import type { Logger, Row } from "../../application/shared/contracts";

/** Yayınlanan bildirim: alıcı anahtarı + arayüzün göstereceği satır. */
export interface StreamedNotification {
  /** "user:<id>", "store:<id>" ya da "admin:" */
  readonly key: string;
  readonly item: Row;
}

/** Alıcıyı tek bir anahtara indirir; abonelik eşleşmesi bununla yapılır. */
export const aliciAnahtari = (scope: string, scopeId: string | null): string => `${scope}:${scopeId ?? ""}`;

const KANAL = "donanex:bildirim";

/**
 * Bildirimleri süreçler arasında taşıyan kanal.
 *
 * Sorun şu: bildirimi WORKER yazıyor (kuyruktan gelen olayı işleyerek), ama
 * tarayıcıya iten açık bağlantı API sürecinde duruyor. İki ayrı süreç ve
 * API'nin veritabanına "yeni bir şey var mı" diye sormasının tek yolu
 * yoklamaydı — her açık sekme için saniyede bir sorgu demek.
 *
 * Redis yayınla/abone ol (pub/sub) bu boşluğu kapatıyor: worker yazdığı anda
 * kanala koyuyor, API dinliyor ve açık bağlantılara iletiyor. Gecikme
 * milisaniye düzeyinde.
 *
 * Redis YOKSA ya da bağlantı düşerse: yayın sessizce atlanır ve available
 * false döner. Bildirim veritabanına yazılmış durumdadır, kaybolmaz — arayüz
 * gerçek zamanlı akışı kuramadığını görüp yoklamaya düşer. Bu yüzden
 * available'ı doğru bildirmek önemli: "bağlandım ama hiçbir şey gelmiyor"
 * durumu, hiç bağlanmamaktan kötüdür.
 *
 * Abonelik AYRI bir bağlantı kullanıyor (duplicate): Redis'te abone kipine
 * geçen bağlantı başka komut kabul etmez, aynı istemci önbellek için de
 * kullanıldığı için paylaşılamaz.
 */
export class RedisNotificationStream {
  private readonly client: RedisClientType;
  private readonly logger: Partial<Logger>;
  private subscriber: RedisClientType | null = null;

  constructor(client: RedisClientType, logger: Partial<Logger> = console) {
    this.client = client;
    this.logger = logger;
  }

  get available(): boolean {
    return this.client.isOpen;
  }

  async publish(items: readonly StreamedNotification[]): Promise<void> {
    if (!items.length || !this.available) return;
    try {
      // Tek seferde birden çok mesaj: bir sipariş ödendiğinde müşteri ve
      // mağazalar aynı anda bildirim alıyor.
      for (const item of items) await this.client.publish(KANAL, JSON.stringify(item));
    } catch (error) {
      const mesaj = error instanceof Error ? error.message : String(error);
      // Yayın başarısız olsa bile bildirim veritabanında duruyor.
      this.logger.warn?.("Bildirim kanalına yazılamadı: {Reason}", { Reason: mesaj });
    }
  }

  /** Kanalı dinlemeye başlar. Çağıran, dönen fonksiyonla aboneliği bırakır. */
  async listen(handler: (notification: StreamedNotification) => void): Promise<void> {
    const subscriber = this.client.duplicate() as RedisClientType;
    subscriber.on("error", (error: Error) => {
      this.logger.warn?.("Bildirim kanalı hatası: {Reason}", { Reason: error.message });
    });
    await subscriber.connect();
    await subscriber.subscribe(KANAL, (message: string) => {
      try {
        handler(JSON.parse(message) as StreamedNotification);
      } catch {
        /* Bozuk mesaj akışı durdurmaz. */
      }
    });
    this.subscriber = subscriber;
  }

  async close(): Promise<void> {
    if (this.subscriber?.isOpen) await this.subscriber.quit();
    this.subscriber = null;
  }
}
