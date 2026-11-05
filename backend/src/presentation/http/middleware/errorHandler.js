"use strict";

const {
  ValidationError,
  NotFoundError,
  ConflictError,
  UnauthorizedError,
  ConfigurationError
} = require("../../../domain/shared/errors");

const STATUS_BY_ERROR = new Map([
  [ValidationError, 400],
  [UnauthorizedError, 401],
  [NotFoundError, 404],
  [ConflictError, 409],
  [ConfigurationError, 503]
]);

function statusFor(error) {
  for (const [ErrorClass, status] of STATUS_BY_ERROR) {
    if (error instanceof ErrorClass) return status;
  }
  return null;
}

/** Domain hatalarını HTTP yanıtına çevirir; beklenmeyen hataların ayrıntısını gizler. */
function errorHandler(error, req, res, _next) {
  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ success: false, message: "Geçersiz istek gövdesi." });
  }
  if (error.type === "entity.too.large") {
    return res.status(413).json({ success: false, message: "İstek çok büyük." });
  }

  const status = statusFor(error);
  if (status) {
    return res.status(status).json({ success: false, message: error.message });
  }

  // Express/body-parser kaynaklı diğer istemci hataları (bozuk URL, desteklenmeyen kodlama...)
  if (Number.isInteger(error.status) && error.status >= 400 && error.status < 500) {
    return res.status(error.status).json({ success: false, message: "Geçersiz istek." });
  }

  console.error(`[${req.method} ${req.originalUrl.split("?")[0]}]`, error);
  return res.status(500).json({
    success: false,
    message: "Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin."
  });
}

function notFoundHandler(_req, res) {
  res.status(404).json({ success: false, message: "Bulunamadı." });
}

module.exports = { errorHandler, notFoundHandler };
