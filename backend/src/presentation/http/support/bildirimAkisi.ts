"use strict";

import type { Response } from "express";
import type { Row } from "../../../application/shared/contracts";
import type { NotificationStreamPort } from "../types";

/** Bağlantının dinlediği alıcı anahtarları ve yazacağı yanıt. */
interface Dinleyici {
  readonly keys: ReadonlySet<string>;
  readonly res: Response;
}

/** Tarayıcı bağlantısı kesilirse yazmaya çalışmamak için her satır sarılı. */
const yaz = (res: Response, veri: string): void => {
  try {
    res.write(veri);
  } catch {
    /* Kapanmış bağlantı; temizlik "close" olayında yapılıyor. */
  }
};

/**
 * Açık bildirim bağlantılarını yöneten dağıtıcı.
 *
 * Redis'e SÜREÇ BAŞINA tek abonelik kuruluyor, bağlantı başına değil: yüz
 * açık sekme yüz Redis bağlantısı demek olurdu. Gelen her bildirim, alıcı
 * anahtarı ("user:<id>", "store:<id>", "admin:") o anahtarı dinleyen
 * bağlantılara iletilir.
 *
 * Abonelik İLK bağlantıda kuruluyor (tembel): kimse bildirim beklemiyorken
 * Redis'te boş bir abone tutmanın anlamı yok.
 */
export function bildirimDagitici(stream: NotificationStreamPort | null) {
  const dinleyiciler = new Set<Dinleyici>();
  let abonelik: Promise<void> | null = null;

  /*
   * Alıcı anahtarı bildirimle BİRLİKTE gönderiliyor.
   *
   * Tek bağlantı, kişinin görebildiği bütün kutuları taşıyor (kendi
   * bildirimleri, mağazalarının ve —yöneticiyse— yönetimin). İstemci gelen
   * satırı hangi kutunun sayacına ekleyeceğini ancak anahtardan bilebilir;
   * anahtar olmasa panel zilleri güncellenemezdi.
   */
  const dagit = ({ key, item }: { key: string; item: Row }): void => {
    for (const dinleyici of dinleyiciler) {
      if (dinleyici.keys.has(key)) {
        yaz(dinleyici.res, `event: bildirim\ndata: ${JSON.stringify({ key, item })}\n\n`);
      }
    }
  };

  /** Aboneliği bir kez kurar; kurulamazsa bir sonraki bağlantıda yeniden denenir. */
  const aboneOl = (): Promise<void> => {
    if (!stream) return Promise.reject(new Error("Bildirim kanalı yok."));
    if (!abonelik) {
      abonelik = stream.listen(dagit).catch((error: unknown) => {
        abonelik = null;
        throw error;
      });
    }
    return abonelik;
  };

  return {
    get available(): boolean {
      return Boolean(stream?.available);
    },

    /** Açık bağlantı sayısı (sağlık ucu ve testler için). */
    get count(): number {
      return dinleyiciler.size;
    },

    /**
     * Bağlantıyı akışa bağlar ve kapanana kadar açık tutar.
     *
     * Nabız (heartbeat) şart: araya giren vekil sunucular sessiz bağlantıyı
     * bir dakika civarında kapatıyor. Yorum satırı (":" ile başlayan) istemci
     * tarafında olay üretmez, yalnızca hattı canlı tutar.
     */
    bagla(res: Response, keys: ReadonlySet<string>, { nabizMs = 25_000 } = {}): void {
      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      // nginx yanıtı tamponlarsa olaylar bağlantı kapanana kadar bekler;
      // bu başlık o tamponu bu uç için kapatır.
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders?.();

      const dinleyici: Dinleyici = { keys, res };
      dinleyiciler.add(dinleyici);
      yaz(res, ": baglandi\n\n");

      const nabiz = setInterval(() => yaz(res, ": nabiz\n\n"), nabizMs);
      // Süreç kapanırken nabız beklemesin.
      nabiz.unref?.();

      const kapat = () => {
        clearInterval(nabiz);
        dinleyiciler.delete(dinleyici);
      };
      res.on("close", kapat);
      res.on("error", kapat);
    },

    aboneOl
  };
}

export type BildirimDagitici = ReturnType<typeof bildirimDagitici>;
