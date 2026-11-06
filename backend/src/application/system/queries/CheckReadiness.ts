"use strict";

import { Query, type Handler } from "../../shared/cqrs/Message";
import type { Cache, HealthReadModel } from "../../shared/contracts";

export class CheckReadinessQuery extends Query {}

export interface Readiness {
  readonly ready: boolean;
  readonly checks: Record<string, boolean>;
}

/** Hazırlık denetimi: veritabanı ve önbellek yanıt veriyor mu? */
export class CheckReadinessHandler implements Handler<CheckReadinessQuery, Readiness> {
  private readonly readModel: HealthReadModel;
  private readonly cache: Cache;

  constructor({ healthReadModel, cache }: { healthReadModel: HealthReadModel; cache: Cache }) {
    this.readModel = healthReadModel;
    this.cache = cache;
  }

  async handle(): Promise<Readiness> {
    const check = async (name: string, probe: () => Promise<unknown>): Promise<[string, boolean]> => {
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
