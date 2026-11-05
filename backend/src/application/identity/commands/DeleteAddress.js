"use strict";

const { Command } = require("../../shared/cqrs/Message");
const { NotFoundError } = require("../../../domain/shared/errors");
const { requireUuid } = require("../../../domain/shared/guards");

class DeleteAddressCommand extends Command {
  constructor(input) {
    super();
    this.userId = input?.userId;
    this.addressId = input?.addressId;
  }
}

class DeleteAddressHandler {
  constructor({ unitOfWork }) {
    this.unitOfWork = unitOfWork;
  }

  async handle({ userId, addressId }) {
    requireUuid(addressId, "Adres numarası");
    // Kullanıcı kimliği sorgunun parçası: başkasının adresi silinemez.
    const removed = await this.unitOfWork.run(({ users }) => users.removeAddress(userId, addressId));
    if (!removed) throw new NotFoundError("Adres bulunamadı.");
  }
}

module.exports = { DeleteAddressCommand, DeleteAddressHandler };
