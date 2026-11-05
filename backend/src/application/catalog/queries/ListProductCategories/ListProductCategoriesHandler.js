"use strict";

class ListProductCategoriesHandler {
  constructor({ productReadModel }) {
    this.readModel = productReadModel;
  }

  handle() {
    return this.readModel.listCategories();
  }
}

module.exports = { ListProductCategoriesHandler };
