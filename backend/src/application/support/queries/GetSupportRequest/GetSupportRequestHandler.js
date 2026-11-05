"use strict";

const { ValidationError, NotFoundError } = require("../../../../domain/shared/errors");
const { isId } = require("../../../../domain/shared/guards");

class GetSupportRequestHandler {
  constructor({ supportReadModel }) {
    this.readModel = supportReadModel;
  }

  async handle({ id }) {
    if (!isId(id)) throw new ValidationError("Geçersiz talep numarası.");
    const request = await this.readModel.get(Number(id));
    if (!request) throw new NotFoundError("Talep bulunamadı.");
    return request;
  }
}

module.exports = { GetSupportRequestHandler };
