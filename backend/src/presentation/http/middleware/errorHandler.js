"use strict";

const {
  ValidationError,
  NotFoundError,
  ConflictError,
  UnauthorizedError,
  ForbiddenError,
  ConfigurationError
} = require("../../../domain/shared/errors");

const STATUS_BY_ERROR = [
  [ValidationError, 400, "validation_error"],
  [UnauthorizedError, 401, "unauthorized"],
  [ForbiddenError, 403, "forbidden"],
  [NotFoundError, 404, "not_found"],
  [ConflictError, 409, "conflict"],
  [ConfigurationError, 503, "service_unavailable"]
];

function classify(error) {
  for (const [ErrorClass, status, code] of STATUS_BY_ERROR) {
    if (error instanceof ErrorClass) return { status, code };
  }
  return null;
}

/**
 * Domain hatalarını HTTP yanıtına çevirir.
 *
 * Beklenen hatalarda kullanıcıya anlamlı bir mesaj döner; beklenmeyen
 * hatalarda ayrıntı GİZLENİR (yığın izi, SQL metni, dosya yolu sızmaz) ve
 * olay istek numarasıyla günlüğe yazılır.
 */
function errorHandler(error, req, res, _next) {
  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ error: "invalid_body", message: "Geçersiz istek gövdesi." });
  }
  if (error.type === "entity.too.large") {
    return res.status(413).json({ error: "payload_too_large", message: "İstek çok büyük." });
  }

  const known = classify(error);
  if (known) {
    return res.status(known.status).json({
      error: known.code,
      message: error.message,
      ...(error.details ? { details: error.details } : {})
    });
  }

  if (Number.isInteger(error.status) && error.status >= 400 && error.status < 500) {
    return res.status(error.status).json({ error: "bad_request", message: "Geçersiz istek." });
  }

  req.log?.error("İşlenmeyen hata: {Reason}", {
    Reason: error.message,
    ErrorType: error.name,
    Path: req.originalUrl.split("?")[0],
    Stack: error.stack
  });

  return res.status(500).json({
    error: "internal_error",
    message: "Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.",
    requestId: req.id
  });
}

function notFoundHandler(_req, res) {
  res.status(404).json({ error: "not_found", message: "Bulunamadı." });
}

module.exports = { errorHandler, notFoundHandler };
