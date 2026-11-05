"use strict";

/**
 * Domain ve application katmanının fırlattığı hatalar.
 * HTTP durum kodlarını BİLMEZLER; eşleme presentation katmanında yapılır.
 */
class DomainError extends Error {
  constructor(message) {
    super(message);
    this.name = this.constructor.name;
  }
}

class ValidationError extends DomainError {}
class NotFoundError extends DomainError {}
class ConflictError extends DomainError {}
class UnauthorizedError extends DomainError {}
class ConfigurationError extends DomainError {}

module.exports = {
  DomainError,
  ValidationError,
  NotFoundError,
  ConflictError,
  UnauthorizedError,
  ConfigurationError
};
