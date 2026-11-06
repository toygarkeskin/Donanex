"use strict";

import { Query, type Handler } from "../../shared/cqrs/Message";
import { assertCan, type UseCaseContext } from "../../shared/authorize";
import type { DashboardReadModel, Row } from "../../shared/contracts";

export type DashboardScope = "store" | "admin";

export class GetDashboardQuery extends Query {
  readonly scope: DashboardScope;
  readonly storeId: string | null;

  constructor(input?: { scope?: DashboardScope; storeId?: string | null }) {
    super();
    this.scope = input?.scope as DashboardScope;
    this.storeId = input?.storeId ?? null;
  }
}

/** Panel özetleri. Mağaza sahibi yalnızca kendi mağazasının sayılarını görür. */
export class GetDashboardHandler implements Handler<GetDashboardQuery, Row, UseCaseContext> {
  private readonly readModel: DashboardReadModel;

  constructor({ dashboardReadModel }: { dashboardReadModel: DashboardReadModel }) {
    this.readModel = dashboardReadModel;
  }

  handle({ scope, storeId }: GetDashboardQuery, context: UseCaseContext = {}): Promise<Row> {
    if (scope === "store") {
      assertCan(context, "order:read", { storeId });
      return this.readModel.storeSummary(storeId as string);
    }
    // Kapsamsız: sistem geneli izin, mağaza rolüyle kazanılamaz.
    assertCan(context, "system:settings");
    return this.readModel.adminSummary();
  }
}
