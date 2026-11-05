"use strict";

class CheckReadinessHandler {
  constructor({ healthReadModel }) {
    this.readModel = healthReadModel;
  }

  async handle() {
    try {
      await this.readModel.ping();
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = { CheckReadinessHandler };
