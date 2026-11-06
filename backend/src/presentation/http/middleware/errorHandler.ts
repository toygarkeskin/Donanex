"use strict";

import type { ErrorRequestHandler, Request, RequestHandler, Response } from "express";

import {
  ValidationError,
  NotFoundError,
  ConflictError,
  UnauthorizedError,
  ForbiddenError,
  ConfigurationError
} from "../../../domain/shared/errors";

type ErrorClass = new (...args: any[]) => Error;

const STATUS_BY_ERROR: readonly (readonly [ErrorClass, number, string])[] = [
  [ValidationError, 400, "validation_error"],
  [UnauthorizedError, 401, "unauthorized"],
  [ForbiddenError, 403, "forbidden"],
  [NotFoundError, 404, "not_found"],
  [ConflictError, 409, "conflict"],
  [ConfigurationError, 503, "service_unavailable"]
];

function classify(error: unknown): { status: number; code: string } | null {
  for (const [ErrorClass, status, code] of STATUS_BY_ERROR) {
    if (error instanceof ErrorClass) return { status, code };
  }
  return null;
}

/**
 * Express'in hata nesnesi: kendi domain hatalarımızın yanında gövde ayrıştırma
 * hataları da buraya düşer, onların alanları farklıdır.
 */
interface HttpishError extends Error {
  readonly type?: string;
  readonly status?: number;
  readonly details?: unknown;
}

/**
 * Domain hatalarını HTTP yanıtına çevirir.
 *
 * Beklenen hatalarda kullanıcıya anlamlı bir mesaj döner; beklenmeyen
 * hatalarda ayrıntı GİZLENİR (yığın izi, SQL metni, dosya yolu sızmaz) ve
 * olay istek numarasıyla günlüğe yazılır.
 */
export const errorHandler: ErrorRequestHandler = (error: HttpishError, req: Request, res: Response, _next) => {
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

  if (Number.isInteger(error.status) && error.status! >= 400 && error.status! < 500) {
    return res.status(error.status!).json({ error: "bad_request", message: "Geçersiz istek." });
  }

  req.log?.error("İşlenmeyen hata: {Reason}", {
    Reason: error.message,
    ErrorType: error.name,
    Path: req.originalUrl.split("?")[0],
    Stack: error.stack
  });

  // Yığın izi ve hata metni İSTEMCİYE GİTMEZ; yalnızca istek numarası verilir.
  return res.status(500).json({
    error: "internal_error",
    message: "Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.",
    requestId: req.id
  });
};

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: "not_found", message: "Bulunamadı." });
};
