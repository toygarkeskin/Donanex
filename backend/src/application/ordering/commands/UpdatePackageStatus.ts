"use strict";

import { Command, type Handler } from "../../shared/cqrs/Message";
import { NotFoundError, ConflictError } from "../../../domain/shared/errors";
import { requireUuid, requireEnum } from "../../../domain/shared/guards";
import { PackageStatus, OrderStatus, type PackageStatusKind } from "../../../domain/ordering/OrderStatus";
import { EventTypes, domainEvent } from "../../../domain/shared/DomainEvent";
import { changePackageStatus } from "../services/releaseStock";
import { assertCan, type UseCaseContext } from "../../shared/authorize";
import type { Cache, Row, UnitOfWork } from "../../shared/contracts";

export class UpdatePackageStatusCommand extends Command {
  readonly storeId: string;
  readonly packageId: string;
  readonly status: PackageStatusKind;

  constructor(input?: { storeId?: string; packageId?: string; status?: unknown }) {
    super();
    this.storeId = input?.storeId as string;
    this.packageId = input?.packageId as string;
    this.status = input?.status as PackageStatusKind;
  }
}

/**
 * Mağazanın kendi paketinin durumunu ilerletmesi. Mağaza yalnızca KENDİ
 * paketine dokunabilir; paket kimliği mağaza kimliğiyle birlikte sorgulanır.
 */
export class UpdatePackageStatusHandler implements Handler<UpdatePackageStatusCommand, Row, UseCaseContext> {
  private readonly unitOfWork: UnitOfWork;
  private readonly cache: Cache;

  constructor({ unitOfWork, cache }: { unitOfWork: UnitOfWork; cache: Cache }) {
    this.unitOfWork = unitOfWork;
    this.cache = cache;
  }

  async handle(
    { storeId, packageId, status }: UpdatePackageStatusCommand,
    context: UseCaseContext = {}
  ): Promise<Row> {
    requireUuid(storeId, "Mağaza numarası");
    requireUuid(packageId, "Paket numarası");
    requireEnum(status, Object.values(PackageStatus) as PackageStatusKind[], "Paket durumu");
    assertCan(context, "order:fulfil", { storeId });
    if (status === PackageStatus.REFUNDED) assertCan(context, "order:refund", { storeId });

    const result = await this.unitOfWork.run(async (repos) => {
      const pkg = await repos.orders.lockPackageForStore(packageId, storeId);
      if (!pkg) throw new NotFoundError("Paket bulunamadı.");

      const order = await repos.orders.findById(pkg.orderId);
      if (!order) throw new NotFoundError("Sipariş bulunamadı.");
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
          userId: order.userId,
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
