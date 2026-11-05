"use strict";

const { Product } = require("../../../../domain/catalog/Product");
const { ValidationError, NotFoundError } = require("../../../../domain/shared/errors");
const { isId } = require("../../../../domain/shared/guards");

class UpdateProductHandler {
  constructor({ unitOfWork }) {
    this.unitOfWork = unitOfWork;
  }

  async handle({ id, data }) {
    if (!isId(id)) throw new ValidationError("Geçersiz ürün numarası.");
    const product = Product.create({ ...data, id: Number(id) }, "Ürün bilgilerini kontrol edin.");

    const updated = await this.unitOfWork.run(({ products }) => products.update(product));
    if (!updated) throw new NotFoundError("Ürün bulunamadı.");
    return updated;
  }
}

module.exports = { UpdateProductHandler };
