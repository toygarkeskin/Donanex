"use strict";

const { ValidationError, NotFoundError } = require("../../../../domain/shared/errors");
const { isId } = require("../../../../domain/shared/guards");

class RestoreProductHandler {
  constructor({ unitOfWork }) {
    this.unitOfWork = unitOfWork;
  }

  async handle({ id }) {
    if (!isId(id)) throw new ValidationError("Geçersiz ürün numarası.");
    const restored = await this.unitOfWork.run(({ products }) => products.setActive(Number(id), true));
    if (!restored) throw new NotFoundError("Ürün bulunamadı.");
  }
}

module.exports = { RestoreProductHandler };
