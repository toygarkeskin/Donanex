"use strict";

const { Router } = require("express");

/**
 * Panelden yüklenen ürün görsellerini sunar.
 *
 * `/api` ağacının DIŞINDADIR: ürün kaydındaki adres `/yuklenen/<ad>.png`
 * biçimindedir ve doğrudan `<img src>` ile çağrılır. Bu yüzden burada oturum
 * aranmaz — görseller zaten herkese açık vitrinde görünür.
 *
 * Güvenlik: dosya adı sunucuda üretilmiştir ve depolama katmanı kalıba
 * uymayan hiçbir adı açmaz. Yanıt başlıkları tarayıcıyı, içeriği başka bir
 * şey sanıp çalıştırmaktan alıkoyar.
 */
function uploadRoutes({ services }) {
  const router = Router();

  router.get("/:fileName", async (req, res, next) => {
    try {
      const { content, contentType } = await services.fileStorage.read(req.params.fileName);

      res.set({
        "Content-Type": contentType,
        // İçeriği tahmin etme: "image/png" diyorsak PNG'dir.
        "X-Content-Type-Options": "nosniff",
        // Tarayıcıda gömülü gösterilsin, indirme diyaloğu açılmasın.
        "Content-Disposition": "inline",
        // Ad içerik değişince değişmediği için (rastgele + tek kullanımlık)
        // dosya sonsuza dek önbelleklenebilir.
        "Cache-Control": "public, max-age=31536000, immutable",
        // Bir HTML sızsa bile çalışmasın.
        "Content-Security-Policy": "default-src 'none'; sandbox"
      });
      res.send(content);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = { uploadRoutes };
