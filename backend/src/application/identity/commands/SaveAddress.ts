"use strict";

import { Command, type Handler } from "../../shared/cqrs/Message";
import { NotFoundError } from "../../../domain/shared/errors";
import { createAddress, type AddressInput } from "../../../domain/identity/User";
import type { IdGenerator, Row, UnitOfWork } from "../../shared/contracts";

export class SaveAddressCommand extends Command {
  readonly userId: string;
  readonly addressId: string | null;
  readonly data: AddressInput | undefined;

  constructor(input?: { userId?: string; addressId?: string | null; data?: AddressInput }) {
    super();
    this.userId = input?.userId as string;
    this.addressId = input?.addressId ?? null;
    this.data = input?.data;
  }
}

export class SaveAddressHandler implements Handler<SaveAddressCommand, Row> {
  private readonly unitOfWork: UnitOfWork;
  private readonly ids: IdGenerator;

  constructor({ unitOfWork, ids }: { unitOfWork: UnitOfWork; ids: IdGenerator }) {
    this.unitOfWork = unitOfWork;
    this.ids = ids;
  }

  async handle({ userId, addressId, data }: SaveAddressCommand): Promise<Row> {
    const address = createAddress(data);

    return this.unitOfWork.run(async ({ users }) => {
      if (addressId) {
        // Kullanıcı kimliği sorgunun parçası: başkasının adresi güncellenemez.
        const updated = await users.updateAddress(userId, addressId, address);
        if (!updated) throw new NotFoundError("Adres bulunamadı.");
        return updated;
      }
      return users.addAddress(userId, { id: this.ids.uuid(), ...address });
    });
  }
}
