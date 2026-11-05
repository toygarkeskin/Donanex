"use strict";

const { ValidationError, NotFoundError } = require("../../../../domain/shared/errors");
const { isId } = require("../../../../domain/shared/guards");

class DeleteSupportRequestHandler {
  constructor({ unitOfWork }) {
    this.unitOfWork = unitOfWork;
  }

  async handle({ id }) {
    if (!isId(id)) throw new ValidationError("Geçersiz talep numarası.");
    const removed = await this.unitOfWork.run(({ support }) => support.remove(Number(id)));
    if (!removed) throw new NotFoundError("Talep bulunamadı.");
  }
}

module.exports = { DeleteSupportRequestHandler };
