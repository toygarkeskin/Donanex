"use strict";

const { ConflictError } = require("../../../domain/shared/errors");
const { releasesStock, assertTransition } = require("../../../domain/ordering/OrderStatus");

/**
 * Sipariş durum değişikliğini, stok iadesiyle birlikte AYNI transaction içinde uygular.
 *
 *  - Geçiş, sipariş yaşam döngüsüne uygun olmalıdır.
 *  - "Test başarısız" / "İptal edildi" durumuna geçen siparişin stoğu bir kez iade edilir.
 *  - Stoğu iade edilmiş sipariş yeniden aktif bir duruma alınamaz.
 *
 * @param repos  unitOfWork.run() içinde verilen repository'ler
 * @param order  repos.orders.lockById() sonucu
 */
async function applyStatusChange(repos, order, newStatus) {
  if (order.status === newStatus) return { id: order.id, status: order.status, total: order.total };

  if (order.stockRestored && !releasesStock(newStatus)) {
    throw new ConflictError(
      "Bu siparişin stoğu iade edildiği için sipariş yeniden aktif bir duruma alınamaz."
    );
  }
  assertTransition(order.status, newStatus);

  const updated = await repos.orders.setStatus(order.id, newStatus);

  if (releasesStock(newStatus) && !order.stockRestored) {
    const lines = await repos.orders.findLines(order.id);
    for (const line of lines) {
      await repos.products.increaseStock(line.productId, line.quantity);
    }
    await repos.orders.markStockRestored(order.id);
  }

  return updated;
}

module.exports = { applyStatusChange };
