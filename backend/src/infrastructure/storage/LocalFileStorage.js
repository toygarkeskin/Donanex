"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const { ValidationError, NotFoundError } = require("../../domain/shared/errors");

/**
 * Yüklenen görselleri diske yazar.
 *
 * Güvenlik kararları — hepsi bilinçli:
 *
 *  1. **Dosya adı kullanıcıdan GELMEZ.** Ad sunucuda üretilir (rastgele 16 bayt
 *     + sabit uzantı). Böylece yol çıkışı (`../`), özel karakter ve üzerine
 *     yazma gibi bütün bir saldırı sınıfı kapanır — temizlemeye çalışmak yerine
 *     girdiyi hiç kullanmıyoruz.
 *  2. **Tür, içeriğe bakılarak doğrulanır.** `Content-Type` başlığı istemcinin
 *     iddiasıdır; dosyanın ilk baytları (sihirli sayı) gerçeği söyler. PHP ya da
 *     HTML içeren bir dosya "image/png" diye gelse bile reddedilir.
 *  3. **Uzantı allowlist'ten seçilir**, isteğe göre değil. Sunucu `.png`, `.jpg`
 *     ya da `.webp` dışında bir şey yazmaz; `.html`, `.svg` ve `.js` dışarıdadır
 *     (SVG içinde script çalışabilir, bu yüzden kasten alınmıyor).
 *  4. **Okurken ad yeniden doğrulanır.** Depodan okuma da ayrı bir kapıdır;
 *     sadece yazarken kontrol etmek yetmez.
 */

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

// Sihirli sayı → uzantı. Sıra önemli değil; eşleşen ilk kayıt kullanılır.
const TURLER = [
  {
    uzanti: ".png",
    mime: "image/png",
    esle: (b) => b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  },
  {
    uzanti: ".jpg",
    mime: "image/jpeg",
    esle: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff
  },
  {
    uzanti: ".webp",
    mime: "image/webp",
    esle: (b) =>
      b.length > 12 && b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP"
  }
];

// Üretilen adın biçimi. Okurken bu kalıba uymayan hiçbir şey açılmaz.
const AD_KALIBI = /^[0-9a-f]{32}\.(png|jpg|webp)$/;

class LocalFileStorage {
  constructor({ directory }) {
    this.directory = path.resolve(directory);
  }

  /** Klasörü açılışta hazırlar; ilk yüklemede hata çıkmasın. */
  async init() {
    await fs.mkdir(this.directory, { recursive: true });
  }

  /**
   * Görseli yazar ve dosya adını döndürür.
   * @param {Buffer} icerik ham dosya
   * @returns {Promise<{ fileName: string, contentType: string, size: number }>}
   */
  async save(icerik) {
    if (!Buffer.isBuffer(icerik) || icerik.length === 0) {
      throw new ValidationError("Dosya boş.");
    }
    if (icerik.length > MAX_BYTES) {
      throw new ValidationError("Görsel en fazla 2 MB olabilir.");
    }

    const tur = TURLER.find((aday) => aday.esle(icerik));
    if (!tur) {
      throw new ValidationError("Yalnızca PNG, JPEG ve WebP görseller yüklenebilir.");
    }

    const fileName = crypto.randomBytes(16).toString("hex") + tur.uzanti;
    await fs.mkdir(this.directory, { recursive: true });
    // "wx": dosya varsa hata ver. Rastgele adda çakışma beklenmez; yine de
    // sessizce üzerine yazmaktansa patlaması yeğdir.
    await fs.writeFile(path.join(this.directory, fileName), icerik, { flag: "wx" });

    return { fileName, contentType: tur.mime, size: icerik.length };
  }

  /**
   * Dosyayı okur. Ad kalıba uymuyorsa hiç diske gidilmez.
   * @returns {Promise<{ content: Buffer, contentType: string }>}
   */
  async read(fileName) {
    if (typeof fileName !== "string" || !AD_KALIBI.test(fileName)) {
      throw new NotFoundError("Görsel bulunamadı.");
    }
    const tam = path.join(this.directory, fileName);
    // path.join ".." temizlese de ikinci bir kapı: sonuç klasörün dışına
    // çıkıyorsa reddet.
    if (!tam.startsWith(this.directory + path.sep)) {
      throw new NotFoundError("Görsel bulunamadı.");
    }

    let content;
    try {
      content = await fs.readFile(tam);
    } catch {
      throw new NotFoundError("Görsel bulunamadı.");
    }

    const uzanti = path.extname(fileName);
    const tur = TURLER.find((aday) => aday.uzanti === uzanti);
    return { content, contentType: tur?.mime ?? "application/octet-stream" };
  }
}

module.exports = { LocalFileStorage, MAX_BYTES };
