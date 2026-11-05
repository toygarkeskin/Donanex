"use strict";

const { Command } = require("../../shared/cqrs/Message");
const { NotFoundError, ConflictError } = require("../../../domain/shared/errors");
const { requireUuid, requireEnum } = require("../../../domain/shared/guards");
const { PackageStatus, OrderStatus } = require("../../../domain/ordering/OrderStatus");
const { EventTypes, domainEvent } = require("../../../domain/shared/DomainEvent");
const { changePackageStatus } = require("../services/releaseStock");
const { assertCan } = require("../../shared/authorize");

class UpdatePackageStatusCommand extends Command {
  constructor(input) {
    super();
    this.storeId = input?.storeId;
    this.packageId = input?.packageId;
    this.status = input?.status;
  }
}

/**
 * Mağazanın kendi paketinin durumunu ilerletmesi. Mağaza yalnızca KENDİ
 * paketine dokunabilir; paket kimliği mağaza kimliğiyle birlikte sorgulanır.
 */
class UpdatePackageStatusHandler {
  constructor({ unitOfWork, cache }) {
    this.unitOfWork = unitOfWork;
    this.cache = cache;
  }

  async handle({ storeId, packageId, status }, context = {}) {
    requireUuid(storeId, "Mağaza numarası");
    requireUuid(packageId, "Paket numarası");
    requireEnum(status, Object.values(PackageStatus), "Paket durumu");
    assertCan(context, "order:fulfil", { storeId });
    if (status === PackageStatus.REFUNDED) assertCan(context, "order:refund", { storeId });

    const result = await this.unitOfWork.run(async (repos) => {
      const pkg = await repos.orders.lockPackageForStore(packageId, storeId);
      if (!pkg) throw new NotFoundError("Paket bulunamadı.");

      const order = await repos.orders.findById(pkg.orderId);
      if (order.status === OrderStatus.PENDING_PAYMENT && status !== PackageStatus.CANCELLED) {
        throw new ConflictError("Ödeme tamamlanmadan paket hazırlanamaz.");
      }

      const updated = await changePackageStatus(repos, { order, pkg, status });

      await repos.outbox.add(
        domainEvent(EventTypes.PACKAGE_STATUS_CHANGED, "order", order.id, {
          orderNumber: order.orderNumber,
          packageId,
          storeId,
          status,
          email: order.contactEmail,
          fullName: order.contactFullName
        })
      );
      await repos.audit.record({
        actorId: context.actorId ?? null,
        action: `package.${status}`,
        resourceType: "order_package",
        resourceId: packageId,
        context
      });
      return updated;
    });

    // İptal ve iade stoğu geri verir.
    await this.cache.deleteByPrefix("catalog:");
    return result;
  }
}

module.exports = { UpdatePackageStatusCommand, UpdatePackageStatusHandler };
