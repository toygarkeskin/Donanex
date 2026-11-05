"use strict";

const { Command } = require("../../shared/cqrs/Message");
const { validateProfileUpdate } = require("../../../domain/identity/User");

class UpdateProfileCommand extends Command {
  constructor(input) {
    super();
    this.userId = input?.userId;
    this.data = input?.data;
  }
}

class UpdateProfileHandler {
  constructor({ unitOfWork }) {
    this.unitOfWork = unitOfWork;
  }

  async handle({ userId, data }) {
    const profile = validateProfileUpdate(data);
    await this.unitOfWork.run(({ users }) => users.updateProfile(userId, profile));
    return profile;
  }
}

module.exports = { UpdateProfileCommand, UpdateProfileHandler };
