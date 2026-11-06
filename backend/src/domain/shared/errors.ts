"use strict";

/**
 * Domain ve application katmanının fırlattığı hatalar.
 * HTTP durum kodlarını BİLMEZLER; eşleme presentation katmanında yapılır.
 */

/** Hataya iliştirilen ek bilgi (ör. hangi alan hatalı). */
export type ErrorDetails = Record<string, unknown>;

export class DomainError extends Error {
  readonly details?: ErrorDetails;

  constructor(message: string, details?: ErrorDetails) {
    super(message);
    this.name = new.target.name;
    if (details !== undefined) this.details = details;
  }
}

/** İstemci hatalı veri gönderdi. */
export class ValidationError extends DomainError {}
/** Kayıt yok ya da isteyenin görmeye hakkı yok (ikisi aynı yanıtı verir). */
export class NotFoundError extends DomainError {}
/** Kurallar bu işleme şu an izin vermiyor. */
export class ConflictError extends DomainError {}
/** Kimlik doğrulanamadı. */
export class UnauthorizedError extends DomainError {}
/** Kimlik doğrulandı ama yetki yok. */
export class ForbiddenError extends DomainError {}
/** Sunucu ayarları eksik. */
export class ConfigurationError extends DomainError {}
