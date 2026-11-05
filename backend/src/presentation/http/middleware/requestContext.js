"use strict";

const crypto = require("crypto");
const { parseCookies } = require("../support/cookies");

/**
 * Her isteğe kimlik ve bağlam ekler: istek numarası, istemci IP'si, tarayıcı.
 * Bu bağlam hem günlüklere hem denetim kaydına gider; bir sorunu uçtan uca
 * izlemek için tek bir numara yeter.
 */
function requestContext(logger) {
  return (req, res, next) => {
    req.id = req.get("x-request-id")?.slice(0, 64) || crypto.randomUUID();
    req.cookies = parseCookies(req);
    req.log = logger.child({ RequestId: req.id });
    req.context = () => ({
      requestId: req.id,
      actorId: req.auth?.userId ?? null,
      policy: req.auth?.policy ?? null,
      ip: req.ip,
      userAgent: req.get("user-agent") || null
    });
    res.setHeader("X-Request-Id", req.id);
    next();
  };
}

/** Tek satırlık erişim günlüğü. Sorgu dizesi ve gövde YAZILMAZ. */
function accessLog() {
  return (req, res, next) => {
    const startedAt = process.hrtime.bigint();
    res.on("finish", () => {
      const path = req.originalUrl.split("?")[0];
      if (path === "/api/health") return;
      const ms = Number(process.hrtime.bigint() - startedAt) / 1e6;
      const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";
      req.log[level]("{Method} {Path} {StatusCode} ({Duration} ms)", {
        Method: req.method,
        Path: path,
        StatusCode: res.statusCode,
        Duration: Number(ms.toFixed(1)),
        UserId: req.auth?.userId ?? null
      });
    });
    next();
  };
}

module.exports = { requestContext, accessLog };
