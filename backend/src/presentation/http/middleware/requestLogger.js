"use strict";

/** Tek satırlık erişim günlüğü. Sorgu dizesi ve gövde yazılmaz (kişisel veri/kod sızmasın). */
function requestLogger(log) {
  return (req, res, next) => {
    const started = process.hrtime.bigint();
    res.on("finish", () => {
      const path = req.originalUrl.split("?")[0];
      if (path === "/api/health") return;
      const ms = Number(process.hrtime.bigint() - started) / 1e6;
      log(`${req.method} ${path} ${res.statusCode} ${ms.toFixed(0)}ms`);
    });
    next();
  };
}

module.exports = { requestLogger };
