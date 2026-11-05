"use strict";

/**
 * Domain ve application katmanının fırlattığı hatalar.
 * HTTP durum kodlarını BİLMEZLER; eşleme presentation katmanında yapılır.
 */
class DomainError extends Error {
  constructor(message, details) {
    super(message);
    this.name = this.constructor.name;
    if (details !== undefined) this.details = details;
  }
}

/** İstemci hatalı veri gönderdi. */
class ValidationError extends DomainError {}
/** Kayıt yok ya da isteyenin görmeye hakkı yok (ikisi aynı yanıtı verir). */
class NotFoundError extends DomainError {}
/** Kurallar bu işleme şu an izin vermiyor. */
class ConflictError extends DomainError {}
/** Kimlik doğrulanamadı. */
class UnauthorizedError extends DomainError {}
/** Kimlik doğrulandı ama yetki yok. */
class ForbiddenError extends DomainError {}
/** Sunucu ayarları eksik. */
class ConfigurationError extends DomainError {}

module.exports = {
  DomainError,
  ValidationError,
  NotFoundError,
  ConflictError,
  UnauthorizedError,
  ForbiddenError,
  ConfigurationError
};
