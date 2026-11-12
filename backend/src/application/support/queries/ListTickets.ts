"use strict";

import { Query, type Handler } from "../../shared/cqrs/Message";
import { optionalEnum } from "../../../domain/shared/guards";
import { TICKET_STATUSES, TICKET_PRIORITIES } from "../../../domain/support/SupportTicket";
import { assertCan, type UseCaseContext } from "../../shared/authorize";
import type { Row, SupportReadModel } from "../../shared/contracts";
import type { TicketScope } from "./GetTicket";

export interface TicketFilters {
  status?: unknown;
  priority?: unknown;
  /** Serbest arama metni; konu ve mesajda tam metin araması yapılır. */
  q?: unknown;
  page?: unknown;
  pageSize?: unknown;
}

export class ListTicketsQuery extends Query {
  readonly scope: TicketScope;
  readonly userId: string | null;
  readonly storeId: string | null;
  readonly filters: TicketFilters;

  constructor(input?: {
    scope?: TicketScope;
    userId?: string | null;
    storeId?: string | null;
    filters?: TicketFilters;
  }) {
    super();
    this.scope = input?.scope as TicketScope;
    this.userId = input?.userId ?? null;
    this.storeId = input?.storeId ?? null;
    this.filters = input?.filters ?? {};
  }
}

export class ListTicketsHandler implements Handler<ListTicketsQuery, Row, UseCaseContext> {
  private readonly readModel: SupportReadModel;

  constructor({ supportReadModel }: { supportReadModel: SupportReadModel }) {
    this.readModel = supportReadModel;
  }

  handle({ scope, userId, storeId, filters }: ListTicketsQuery, context: UseCaseContext = {}): Promise<Row> {
    const page = Math.max(1, Number(filters.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(filters.pageSize) || 20));
    const paging = { limit: pageSize, offset: (page - 1) * pageSize, page, pageSize };

    const status = optionalEnum(filters.status, TICKET_STATUSES, "Talep durumu");
    const priority = optionalEnum(filters.priority, TICKET_PRIORITIES, "Talep önceliği");
    /*
     * Arama metni UZUNLUK SINIRIYLA geçiyor. Serbest metin doğrudan tam metin
     * sorgusuna gidiyor; sınırsız bırakılsa binlerce kelimelik bir girdi
     * sorguyu gereksiz yere pahalı kılabilirdi. 200 karakter, bir arama
     * kutusuna yazılan her şey için fazlasıyla yeterli.
     */
    const q = typeof filters.q === "string" ? filters.q.trim().slice(0, 200) : null;
    const suzgecler = { ...paging, status, priority, q };

    if (scope === "store") {
      assertCan(context, "support:read", { storeId });
      return this.readModel.listForStore(storeId as string, suzgecler);
    }
    if (scope === "admin") {
      assertCan(context, "support:read");
      return this.readModel.listForAdmin(suzgecler);
    }
    // Müşterinin kendi listesi süzülmüyor: birkaç talep için arama gereksiz.
    return this.readModel.listForUser(userId as string, paging);
  }
}
