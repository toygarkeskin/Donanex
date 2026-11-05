"use strict";

const { Command } = require("../../shared/cqrs/Message");
const { NotFoundError } = require("../../../domain/shared/errors");
const { requireUuid } = require("../../../domain/shared/guards");
const { createShipping } = require("../../../domain/ordering/Shipping");
const { assertCan } = require("../../shared/authorize");

class UpdatePackageShippingCommand extends Command {
  constructor(input) {
    super();
    this.storeId = input?.storeId;
    this.packageId = input?.packageId;
    this.data = input?.data;
  }
}

class UpdatePackageShippingHandler {
  constructor({ unitOfWork }) {
    this.unitOfWork = unitOfWork;
  }

  async handle({ storeId, packageId, data }, context = {}) {
    requireUuid(storeId, "Mağaza numarası");
    requireUuid(packageId, "Paket numarası");
    assertCan(context, "order:fulfil", { storeId });
    const shipping = createShipping(data);

    return this.unitOfWork.run(async (repos) => {
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

module.exports = { UpdatePackageShippingCommand, UpdatePackageShippingHandler };
