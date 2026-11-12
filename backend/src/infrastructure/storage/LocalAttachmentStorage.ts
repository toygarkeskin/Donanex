"use strict";

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

import { ValidationError, NotFoundError } from "../../domain/shared/errors";
import { MAX_ATTACHMENT_BYTES } from "../../domain/support/Attachment";
import { TURLER, type GorselTuru } from "./LocalFileStorage";
import type { AttachmentStorage } from "../../application/shared/contracts";

/**
 * Destek talebi eklerinin deposu.
 *
 * Ürün görseli deposuyla (LocalFileStorage) AYNI güvenlik kararlarını taşıyor —
 * ad sunucuda üretilir, tür baytlardan okunur, okurken ad yeniden doğrulanır —
 * ama iki önemli farkla:
 *
 *  1. AYRI KLASÖR. Görseller "/yuklenen/<ad>" adresinden herkese açık
 *     sunuluyor. Ekler kişisel içerik taşıyor (ekran görüntüsü, fatura) ve o
 *     uçtan ASLA erişilmemeli. Ekler yükleme klasörünün "ekler" alt klasörüne
 *     yazılıyor; görsel deposunun ad kalıbı "/" içeremediği için alt klasöre
 *     ulaşmanın yolu yok. Her indirme, talebe erişim yetkisi sorulan bir uçtan
 *     geçiyor.
 *  2. PDF kabul ediliyor (fatura ve sipariş belgesi için). SVG, HTML, Office
 *     belgeleri ve arşivler (zip) bilinçli olarak dışarıda: ilk ikisi tarayıcıda
 *     betik çalıştırabilir, son ikisi içeriği denetlenemeyen kaplar.
 */

const PDF: GorselTuru = {
  uzanti: ".pdf",
  mime: "application/pdf",
  // "%PDF-" imzası. Gövdenin geri kalanı denetlenmiyor: PDF indirme olarak
  // veriliyor ve tarayıcıda bu sitenin bağlamında hiç açılmıyor.
  esle: (b) => b.length > 5 && b.subarray(0, 5).toString("ascii") === "%PDF-"
};

const TURLER_EK: readonly GorselTuru[] = [...TURLER, PDF];

const AD_KALIBI = /^[0-9a-f]{32}\.(png|jpg|webp|pdf)$/;

export class LocalAttachmentStorage implements AttachmentStorage {
  private readonly directory: string;

  constructor({ directory }: { directory: string }) {
    this.directory = path.resolve(directory);
  }

  async init(): Promise<void> {
    await fs.mkdir(this.directory, { recursive: true });
  }

  async save(icerik: Buffer): Promise<{ fileName: string; contentType: string; size: number }> {
    if (!Buffer.isBuffer(icerik) || icerik.length === 0) {
      throw new ValidationError("Dosya boş.");
    }
    if (icerik.length > MAX_ATTACHMENT_BYTES) {
      throw new ValidationError("Ek en fazla 5 MB olabilir.");
    }

    const tur = TURLER_EK.find((aday) => aday.esle(icerik));
    if (!tur) {
      throw new ValidationError("Yalnızca PNG, JPEG, WebP görseller ve PDF eklenebilir.");
    }

    const fileName = crypto.randomBytes(16).toString("hex") + tur.uzanti;
    await fs.mkdir(this.directory, { recursive: true });
    await fs.writeFile(this.yol(fileName), icerik, { flag: "wx" });
    return { fileName, contentType: tur.mime, size: icerik.length };
  }

  async read(fileName: string): Promise<{ content: Buffer; contentType: string }> {
    const tam = this.yol(fileName);
    let content: Buffer;
    try {
      content = await fs.readFile(tam);
    } catch {
      throw new NotFoundError("Ek bulunamadı.");
    }
    const tur = TURLER_EK.find((aday) => aday.uzanti === path.extname(fileName));
    return { content, contentType: tur?.mime ?? "application/octet-stream" };
  }

  /**
   * Dosyayı siler; zaten yoksa sessiz geçer.
   *
   * Kayıt yazılamadığında (sınır aşıldı, talep kapandı) diskte sahipsiz dosya
   * kalmasın diye çağrılıyor.
   */
  async remove(fileName: string): Promise<void> {
    try {
      await fs.unlink(this.yol(fileName));
    } catch {
      /* yoksa sorun değil */
    }
  }

  /** Ad kalıba uymuyorsa ya da klasör dışına çıkıyorsa diske hiç gidilmez. */
  private yol(fileName: string): string {
    if (typeof fileName !== "string" || !AD_KALIBI.test(fileName)) {
      throw new NotFoundError("Ek bulunamadı.");
    }
    const tam = path.join(this.directory, fileName);
    if (!tam.startsWith(this.directory + path.sep)) throw new NotFoundError("Ek bulunamadı.");
    return tam;
  }
}
