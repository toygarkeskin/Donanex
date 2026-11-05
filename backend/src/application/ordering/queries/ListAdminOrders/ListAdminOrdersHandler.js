"use strict";

const { isValidStatus, nextStatuses } = require("../../../../domain/ordering/OrderStatus");

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 1000; // CSV dışa aktarma için
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const toDate = (value) => (typeof value === "string" && DATE.test(value) && !Number.isNaN(Date.parse(value)) ? value : null);

function toPositiveInt(value, fallback, max) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) return fallback;
  return Math.min(number, max);
}

class ListAdminOrdersHandler {
  constructor({ orderReadModel }) {
    this.readModel = orderReadModel;
  }

  async handle({ filters }) {
    const pageSize = toPositiveInt(filters.pageSize, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const page = toPositiveInt(filters.page, 1, 1_000_000);

    const { orders, total } = await this.readModel.listForAdmin({
      search: typeof filters.q === "string" ? filters.q.trim().slice(0, 100) : "",
      status: isValidStatus(filters.status) ? filters.status : null,
      from: toDate(filters.from),
      to: toDate(filters.to),
      limit: pageSize,
      offset: (page - 1) * pageSize
    });

    return {
      total,
      page,
      pageSize,
      pages: Math.max(1, Math.ceil(total / pageSize)),
      orders: orders.map((order) => ({ ...order, allowed_statuses: nextStatuses(order.status) }))
    };
  }
}

module.exports = { ListAdminOrdersHandler };
