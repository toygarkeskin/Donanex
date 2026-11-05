"use strict";

const { isId } = require("../../../../domain/shared/guards");

const MAX_IDS = 200;

const list = (value) =>
  typeof value === "string"
    ? value.split(",").map((part) => part.trim()).filter(Boolean)
    : [];

/** Vitrin listesi. Filtreler: arama metni, kategoriler, ürün numaraları (sepet/favori için). */
class ListStoreProductsHandler {
  constructor({ productReadModel }) {
    this.readModel = productReadModel;
  }

  handle({ filters }) {
    const search = typeof filters.search === "string" ? filters.search.trim().slice(0, 100) : "";
    const categories = list(filters.categories).slice(0, 20);
    const ids = list(filters.ids).filter(isId).slice(0, MAX_IDS).map(Number);
    const onlyIds = typeof filters.ids === "string";

    return this.readModel.listForStore({ search, categories, ids: onlyIds ? ids : null });
  }
}

module.exports = { ListStoreProductsHandler };
