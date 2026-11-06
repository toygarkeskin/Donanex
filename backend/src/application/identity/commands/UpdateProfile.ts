"use strict";

import { Command, type Handler } from "../../shared/cqrs/Message";
import { validateProfileUpdate, type ProfileUpdate } from "../../../domain/identity/User";
import type { UnitOfWork } from "../../shared/contracts";

export class UpdateProfileCommand extends Command {
  readonly userId: string;
  readonly data: { fullName?: unknown; phone?: unknown } | undefined;

  constructor(input?: { userId?: string; data?: { fullName?: unknown; phone?: unknown } }) {
    super();
    this.userId = input?.userId as string;
    this.data = input?.data;
  }
}

export class UpdateProfileHandler implements Handler<UpdateProfileCommand, ProfileUpdate> {
  private readonly unitOfWork: UnitOfWork;

  constructor({ unitOfWork }: { unitOfWork: UnitOfWork }) {
    this.unitOfWork = unitOfWork;
  }

  async handle({ userId, data }: UpdateProfileCommand): Promise<ProfileUpdate> {
    const profile = validateProfileUpdate(data);
    await this.unitOfWork.run(({ users }) => users.updateProfile(userId, profile));
    return profile;
  }
}
