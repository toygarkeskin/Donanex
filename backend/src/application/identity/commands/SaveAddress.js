"use strict";

const { Command } = require("../../shared/cqrs/Message");
const { NotFoundError } = require("../../../domain/shared/errors");
const { createAddress } = require("../../../domain/identity/User");

class SaveAddressCommand extends Command {
  constructor(input) {
    super();
    this.userId = input?.userId;
    this.addressId = input?.addressId ?? null;
    this.data = input?.data;
  }
}

class SaveAddressHandler {
  constructor({ unitOfWork, ids }) {
    this.unitOfWork = unitOfWork;
    this.ids = ids;
  }

  async handle({ userId, addressId, data }) {
    const address = createAddress(data);

    return this.unitOfWork.run(async ({ users }) => {
      if (addressId) {
        const updated = await users.updateAddress(userId, addressId, address);
        if (!updated) throw new NotFoundError("Adres bulunamadı.");
        return updated;
      }
      return users.addAddress(userId, { id: this.ids.uuid(), ...address });
    });
  }
}

module.exports = { SaveAddressCommand, SaveAddressHandler };
