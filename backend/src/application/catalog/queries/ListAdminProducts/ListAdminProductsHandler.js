"use strict";

class ListAdminProductsHandler {
  constructor({ productReadModel }) {
    this.readModel = productReadModel;
  }

  handle() {
    return this.readModel.listForAdmin();
  }
}

module.exports = { ListAdminProductsHandler };
