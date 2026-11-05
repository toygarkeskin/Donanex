"use strict";

const { releasesStock, assertPackageTransition, deriveOrderStatus } = require("../../../domain/ordering/OrderStatus");

/**
 * Paket durumunu değiştirir ve gerekiyorsa ayrılan stoğu AYNI transaction
 * içinde iade eder.
 *
 * Kurallar:
 *  - Stok yalnızca bir kez iade edilir (paketin stock_released işareti).
 *  - Stoğu iade edilmiş paket yeniden aktif bir duruma alınamaz; aksi halde
 *    aynı stok ikinci kez satılabilirdi.
 *  - Siparişin genel durumu paketlerden türetilir.
 */
async function changePackageStatus(repos, { order, pkg, status }) {
  if (pkg.status === status) return pkg;

  assertPackageTransition(pkg.status, status);
  const updated = await repos.orders.setPackageStatus(pkg.id, status);

  if (releasesStock(status) && !pkg.stockReleased) {
    const items = await repos.orders.listPackageItems(pkg.id);
    for (const item of items) {
      await repos.products.increaseStock(item.productId, item.quantity);
    }
    await repos.orders.markPackageStockReleased(pkg.id);
  }

  const statuses = await repos.orders.listPackageStatuses(order.id);
  const nextOrderStatus = deriveOrderStatus(order.status, statuses);
  if (nextOrderStatus !== order.status) {
    await repos.orders.setStatus(order.id, nextOrderStatus);
  }

  return { ...updated, orderStatus: nextOrderStatus };
}

module.exports = { changePackageStatus };
