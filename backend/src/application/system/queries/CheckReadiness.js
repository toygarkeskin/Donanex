"use strict";

const { Query } = require("../../shared/cqrs/Message");

class CheckReadinessQuery extends Query {}

/** Hazırlık denetimi: veritabanı ve önbellek yanıt veriyor mu? */
class CheckReadinessHandler {
  constructor({ healthReadModel, cache }) {
    this.readModel = healthReadModel;
    this.cache = cache;
  }

  async handle() {
    const check = async (name, probe) => {
      try {
        await probe();
        return [name, true];
      } catch {
        return [name, false];
      }
    };

    const results = await Promise.all([
      check("database", () => this.readModel.ping()),
      check("cache", () => this.cache.set("health:ping", 1, 5))
    ]);

    const checks = Object.fromEntries(results);
    return { ready: Object.values(checks).every(Boolean), checks };
  }
}

module.exports = { CheckReadinessQuery, CheckReadinessHandler };
