"use strict";

import type { RouteContext } from "../types";

import { yol } from "../support/params";
import { Router } from "express";
import {
  ListProductsQuery,
  GetProductQuery,
  ListCategoriesQuery,
  ListBrandsQuery,
  GetBrandQuery
} from "../../../application/catalog";
import { ListStoresQuery, GetStoreQuery } from "../../../application/stores";

/**
 * Vitrin. Tamamı herkese açıktır: kayıtsız kullanıcı ürünleri görür,
 * arar ve filtreler. Giriş yalnızca sipariş geçmişi gibi kişisel
 * bilgiler için gerekir.
 */
export function catalogRoutes({ queries }: Pick<RouteContext, "queries">): Router {
  const router = Router();

  router.get("/products", async (req, res) => {
    res.json(await queries.ask(new ListProductsQuery(req.query)));
  });

  router.get("/products/:storeSlug/:productSlug", async (req, res) => {
    res.json(
      await queries.ask(
        new GetProductQuery({ storeSlug: yol(req, "storeSlug"), productSlug: yol(req, "productSlug") })
      )
    );
  });

  router.get("/categories", async (_req, res) => {
    res.json({ items: await queries.ask(new ListCategoriesQuery()) });
  });

  router.get("/brands", async (_req, res) => {
    res.json({ items: await queries.ask(new ListBrandsQuery()) });
  });

  router.get("/brands/:slug", async (req, res) => {
    res.json(await queries.ask(new GetBrandQuery({ slug: yol(req, "slug") })));
  });

  router.get("/storefront/stores", async (req, res) => {
    res.json({ items: await queries.ask(new ListStoresQuery(req.query)) });
  });

  router.get("/storefront/stores/:slug", async (req, res) => {
    res.json(await queries.ask(new GetStoreQuery({ slug: yol(req, "slug") })));
  });

  return router;
}

