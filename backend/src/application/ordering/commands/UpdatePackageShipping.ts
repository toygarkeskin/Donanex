"use strict";

import { Command, type Handler } from "../../shared/cqrs/Message";
import { NotFoundError } from "../../../domain/shared/errors";
import { requireUuid } from "../../../domain/shared/guards";
import { createShipping, type ShippingInput } from "../../../domain/ordering/Shipping";
import { assertCan, type UseCaseContext } from "../../shared/authorize";
import type { Row, UnitOfWork } from "../../shared/contracts";

export class UpdatePackageShippingCommand extends Command {
  readonly storeId: string;
  readonly packageId: string;
  readonly data: ShippingInput | undefined;

  constructor(input?: { storeId?: string; packageId?: string; data?: ShippingInput }) {
    super();
    this.storeId = input?.storeId as string;
    this.packageId = input?.packageId as string;
    this.data = input?.data;
  }
}

export class UpdatePackageShippingHandler implements Handler<UpdatePackageShippingCommand, Row, UseCaseContext> {
  private readonly unitOfWork: UnitOfWork;

  constructor({ unitOfWork }: { unitOfWork: UnitOfWork }) {
    this.unitOfWork = unitOfWork;
  }

  async handle(
    { storeId, packageId, data }: UpdatePackageShippingCommand,
    context: UseCaseContext = {}
  ): Promise<Row> {
    requireUuid(storeId, "Mağaza numarası");
    requireUuid(packageId, "Paket numarası");
    assertCan(context, "order:fulfil", { storeId });
    const shipping = createShipping(data);

    return this.unitOfWork.run(async (repos) => {
      // storeId sorgunun parçası: başka mağazanın paketi güncellenemez.
      const updated = await repos.orders.setPackageShipping(packageId, storeId, shipping);
      if (!updated) throw new NotFoundError("Paket bulunamadı.");
      await repos.audit.record({
        actorId: context.actorId ?? null,
        action: "package.shipping_updated",
        resourceType: "order_package",
        resourceId: packageId,
        context
      });
      return updated;
    });
  }
}
