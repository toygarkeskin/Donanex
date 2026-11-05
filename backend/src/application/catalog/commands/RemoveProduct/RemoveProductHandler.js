"use strict";

const { ValidationError, NotFoundError } = require("../../../../domain/shared/errors");
const { isId } = require("../../../../domain/shared/guards");

/**
 * Hiç satılmamış ürün silinir. Geçmiş siparişlerde geçen ürün silinemez
 * (sipariş kaydı bozulur); satıştan kaldırılır ve sonradan geri alınabilir.
 */
class RemoveProductHandler {
  constructor({ unitOfWork }) {
    this.unitOfWork = unitOfWork;
  }

  async handle({ id }) {
    if (!isId(id)) throw new ValidationError("Geçersiz ürün numarası.");
    const productId = Number(id);

    return this.unitOfWork.run(async ({ products }) => {
      if (await products.isReferencedByOrders(productId)) {
        const archived = await products.setActive(productId, false);
        if (!archived) throw new NotFoundError("Ürün bulunamadı.");
        return { archived: true };
      }
      const removed = await products.remove(productId);
      if (!removed) throw new NotFoundError("Ürün bulunamadı.");
      return { archived: false };
    });
  }
}

module.exports = { RemoveProductHandler };
