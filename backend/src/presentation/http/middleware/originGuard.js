"use strict";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * CSRF'e karşı ikinci savunma hattı.
 *
 * Birinci hat SameSite çerezleridir. Burada ayrıca, durum değiştiren
 * isteklerde Origin başlığının kendi sunucumuzu göstermesi aranır.
 * Tarayıcı Origin'i taklit edilemez; başka bir siteden gönderilen istek
 * çerezleri taşısa bile burada durur.
 */
function originGuard(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();

  const reject = () =>
    res.status(403).json({ error: "forbidden_origin", message: "Bu kaynaktan gelen istek kabul edilmiyor." });

  const origin = req.get("origin");
  if (origin) {
    let host = null;
    try {
      host = new URL(origin).host;
    } catch {
      return reject();
    }
    if (host !== req.get("host")) return reject();
  }

  if (req.get("sec-fetch-site") === "cross-site") return reject();
  return next();
}

module.exports = { originGuard };
