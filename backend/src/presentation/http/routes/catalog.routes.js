"use strict";

const { Router } = require("express");
const {
  ListProductsQuery,
  GetProductQuery,
  ListCategoriesQuery
} = require("../../../application/catalog");
const { ListStoresQuery, GetStoreQuery } = require("../../../application/stores");

/**
 * Vitrin. Tamamı herkese açıktır: kayıtsız kullanıcı ürünleri görür,
 * arar ve filtreler. Giriş yalnızca sipariş geçmişi gibi kişisel
 * bilgiler için gerekir.
 */
function catalogRoutes({ queries }) {
  const router = Router();

  router.get("/products", async (req, res) => {
    res.json(await queries.ask(new ListProductsQuery(req.query)));
  });

  router.get("/products/:storeSlug/:productSlug", async (req, res) => {
    res.json(
      await queries.ask(
        new GetProductQuery({ storeSlug: req.params.storeSlug, productSlug: req.params.productSlug })
      )
    );
  });

  router.get("/categories", async (_req, res) => {
    res.json({ items: await queries.ask(new ListCategoriesQuery()) });
  });

  router.get("/storefront/stores", async (req, res) => {
    res.json({ items: await queries.ask(new ListStoresQuery(req.query)) });
  });

  router.get("/storefront/stores/:slug", async (req, res) => {
    res.json(await queries.ask(new GetStoreQuery({ slug: req.params.slug })));
  });

  return router;
}

module.exports = { catalogRoutes };
