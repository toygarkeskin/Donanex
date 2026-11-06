"use strict";

import { Command, type Handler } from "../../shared/cqrs/Message";
import { NotFoundError } from "../../../domain/shared/errors";
import { requireUuid } from "../../../domain/shared/guards";
import type { UnitOfWork } from "../../shared/contracts";

export class DeleteAddressCommand extends Command {
  readonly userId: string;
  readonly addressId: string;

  constructor(input?: { userId?: string; addressId?: string }) {
    super();
    this.userId = input?.userId as string;
    this.addressId = input?.addressId as string;
  }
}

export class DeleteAddressHandler implements Handler<DeleteAddressCommand, void> {
  private readonly unitOfWork: UnitOfWork;

  constructor({ unitOfWork }: { unitOfWork: UnitOfWork }) {
    this.unitOfWork = unitOfWork;
  }

  async handle({ userId, addressId }: DeleteAddressCommand): Promise<void> {
    requireUuid(addressId, "Adres numarası");
    // Kullanıcı kimliği sorgunun parçası: başkasının adresi silinemez.
    const removed = await this.unitOfWork.run(({ users }) => users.removeAddress(userId, addressId));
    if (!removed) throw new NotFoundError("Adres bulunamadı.");
  }
}
