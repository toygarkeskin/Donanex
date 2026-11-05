"use strict";

const { Router } = require("express");
const { ListStoreProductsQuery, ListProductCategoriesQuery } = require("../../../application/catalog");

function catalogRoutes({ queries }) {
  const router = Router();

  router.get("/products", async (req, res) => {
    const { q, category, ids } = req.query;
    const products = await queries.ask(new ListStoreProductsQuery({ search: q, categories: category, ids }));
    res.json({ success: true, products });
  });

  router.get("/product-categories", async (_req, res) => {
    res.json({ success: true, categories: await queries.ask(new ListProductCategoriesQuery()) });
  });

  return router;
}

module.exports = { catalogRoutes };
