"use strict";

const { createSupportRequest } = require("../../../../domain/support/SupportRequest");

class CreateSupportRequestHandler {
  constructor({ unitOfWork }) {
    this.unitOfWork = unitOfWork;
  }

  async handle({ data }) {
    const request = createSupportRequest(data);
    return this.unitOfWork.run(({ support }) => support.add(request));
  }
}

module.exports = { CreateSupportRequestHandler };
