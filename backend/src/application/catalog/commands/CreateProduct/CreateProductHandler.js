"use strict";

const { Product } = require("../../../../domain/catalog/Product");

class CreateProductHandler {
  constructor({ unitOfWork }) {
    this.unitOfWork = unitOfWork;
  }

  async handle({ data }) {
    const product = Product.create(data);
    return this.unitOfWork.run(({ products }) => products.add(product));
  }
}

module.exports = { CreateProductHandler };
