"use strict";

const { CreateProductCommand } = require("./commands/CreateProduct/CreateProductCommand");
const { CreateProductHandler } = require("./commands/CreateProduct/CreateProductHandler");
const { UpdateProductCommand } = require("./commands/UpdateProduct/UpdateProductCommand");
const { UpdateProductHandler } = require("./commands/UpdateProduct/UpdateProductHandler");
const { RemoveProductCommand } = require("./commands/RemoveProduct/RemoveProductCommand");
const { RemoveProductHandler } = require("./commands/RemoveProduct/RemoveProductHandler");
const { RestoreProductCommand } = require("./commands/RestoreProduct/RestoreProductCommand");
const { RestoreProductHandler } = require("./commands/RestoreProduct/RestoreProductHandler");
const { ImportProductsCommand } = require("./commands/ImportProducts/ImportProductsCommand");
const { ImportProductsHandler } = require("./commands/ImportProducts/ImportProductsHandler");
const { ListStoreProductsQuery } = require("./queries/ListStoreProducts/ListStoreProductsQuery");
const { ListStoreProductsHandler } = require("./queries/ListStoreProducts/ListStoreProductsHandler");
const { ListProductCategoriesQuery } = require("./queries/ListProductCategories/ListProductCategoriesQuery");
const { ListProductCategoriesHandler } = require("./queries/ListProductCategories/ListProductCategoriesHandler");
const { ListAdminProductsQuery } = require("./queries/ListAdminProducts/ListAdminProductsQuery");
const { ListAdminProductsHandler } = require("./queries/ListAdminProducts/ListAdminProductsHandler");

module.exports = {
  CreateProductCommand,
  UpdateProductCommand,
  RemoveProductCommand,
  RestoreProductCommand,
  ImportProductsCommand,
  ListStoreProductsQuery,
  ListProductCategoriesQuery,
  ListAdminProductsQuery,
  commandHandlers: [
    [CreateProductCommand, CreateProductHandler],
    [UpdateProductCommand, UpdateProductHandler],
    [RemoveProductCommand, RemoveProductHandler],
    [RestoreProductCommand, RestoreProductHandler],
    [ImportProductsCommand, ImportProductsHandler]
  ],
  queryHandlers: [
    [ListStoreProductsQuery, ListStoreProductsHandler],
    [ListProductCategoriesQuery, ListProductCategoriesHandler],
    [ListAdminProductsQuery, ListAdminProductsHandler]
  ]
};
