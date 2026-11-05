"use strict";

const { Product } = require("../../../../domain/catalog/Product");
const { ValidationError } = require("../../../../domain/shared/errors");

const MAX_IMPORT = 500;

/** Yönetici panelindeki CSV içe aktarma. Hepsi ya eklenir ya hiçbiri. */
class ImportProductsHandler {
  constructor({ unitOfWork }) {
    this.unitOfWork = unitOfWork;
  }

  async handle({ rows }) {
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new ValidationError("İçe aktarılacak ürün bulunamadı.");
    }
    if (rows.length > MAX_IMPORT) {
      throw new ValidationError(`Tek seferde en fazla ${MAX_IMPORT} ürün içe aktarabilirsin.`);
    }

    // CSV'de 1. satır başlık olduğundan veri satırları 2'den başlar.
    const products = rows.map((row, index) => Product.fromImportRow(row, index + 2));
    const count = await this.unitOfWork.run(({ products: repo }) => repo.addMany(products));
    return { count };
  }
}

module.exports = { ImportProductsHandler, MAX_IMPORT };
