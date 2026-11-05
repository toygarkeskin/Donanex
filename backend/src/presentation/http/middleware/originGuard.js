"use strict";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * CSRF için ikinci savunma hattı (ilki SameSite=Strict çerezler):
 * durum değiştiren isteklerde başka bir siteden gelen Origin reddedilir.
 */
function originGuard(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();

  const origin = req.get("origin");
  if (origin) {
    let originHost = null;
    try {
      originHost = new URL(origin).host;
    } catch {
      /* aşağıda reddedilir */
    }
    if (originHost !== req.get("host")) {
      return res.status(403).json({ success: false, message: "Bu kaynaktan gelen istek kabul edilmiyor." });
    }
  }
  if (req.get("sec-fetch-site") === "cross-site") {
    return res.status(403).json({ success: false, message: "Bu kaynaktan gelen istek kabul edilmiyor." });
  }
  next();
}

module.exports = { originGuard };
