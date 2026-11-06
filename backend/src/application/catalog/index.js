"use strict";

const { defineContext } = require("../shared/registry");

module.exports = defineContext({
  name: "catalog",
  commands: {
    CreateProduct: require("./commands/CreateProduct"),
    UpdateProduct: require("./commands/UpdateProduct"),
    SetProductStatus: require("./commands/SetProductStatus"),
    DeleteProduct: require("./commands/DeleteProduct"),
    ImportProducts: require("./commands/ImportProducts"),
    UploadProductImage: require("./commands/UploadProductImage"),
    CreateCategory: require("./commands/CreateCategory")
  },
  queries: {
    ListProducts: require("./queries/ListProducts"),
    GetProduct: require("./queries/GetProduct"),
    ListCategories: require("./queries/ListCategories"),
    ListStoreProducts: require("./queries/ListStoreProducts")
  }
});
