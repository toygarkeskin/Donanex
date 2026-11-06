"use strict";

import type { RouteContext } from "../types";
import type { ProductDeleteResult, ProductImportResult, Sonuc, StoreMemberResult } from "../support/results";

import { yol } from "../support/params";
import { Router, raw, type Request } from "express";
import {
  CreateProductCommand,
  UpdateProductCommand,
  SetProductStatusCommand,
  DeleteProductCommand,
  ImportProductsCommand,
  UploadProductImageCommand,
  ListStoreProductsQuery
} from "../../../application/catalog";
import {
  ListStoreOrdersQuery,
  GetStoreOrderQuery,
  UpdatePackageStatusCommand,
  UpdatePackageShippingCommand
} from "../../../application/ordering";
import {
  GetStoreForMemberQuery,
  UpdateStoreCommand,
  ListStoreMembersQuery,
  ManageStoreMemberCommand
} from "../../../application/stores";
import { ListTicketsQuery, GetTicketQuery, ReplyToTicketCommand } from "../../../application/support";
import { GetDashboardQuery } from "../../../application/system";
import { requireAuth, requirePermission } from "../middleware/authenticate";

/**
 * Mağaza paneli. Her uç mağazaya göre kapsamlıdır: yetki denetimi
 * "bu kişi BU mağazada şunu yapabilir mi?" sorusunu sorar, böylece bir mağaza
 * sahibi başka bir mağazanın verisine hiçbir yoldan erişemez.
 */
export function storePanelRoutes({ commands, queries }: Pick<RouteContext, "commands" | "queries">): Router {
  const router = Router();
  /** Yetki hep MAĞAZA kapsamında sorulur: başka mağazanın verisine yol yok. */
  const inStore = (req: Request) => ({ storeId: yol(req, "storeId") });
  const may = (permission: string) => requirePermission(permission, inStore);

  router.use(requireAuth);

  router.get("/:storeId", may("store:read"), async (req, res) => {
    res.json(await queries.ask(new GetStoreForMemberQuery({ storeId: yol(req, "storeId") }), req.context()));
  });

  router.put("/:storeId", may("store:write"), async (req, res) => {
    const store = await commands.execute<Sonuc>(
      new UpdateStoreCommand({ storeId: yol(req, "storeId"), data: req.body }),
      req.context()
    );
    res.json({ ...store, message: "Mağaza bilgileri güncellendi." });
  });

  router.get("/:storeId/dashboard", may("order:read"), async (req, res) => {
    res.json(await queries.ask(new GetDashboardQuery({ scope: "store", storeId: yol(req, "storeId") }), req.context()));
  });

  /* ----- ürünler ----- */

  router.get("/:storeId/products", may("catalog:product:read"), async (req, res) => {
    res.json(
      await queries.ask(
        new ListStoreProductsQuery({ storeId: yol(req, "storeId"), filters: req.query }),
        req.context()
      )
    );
  });

  router.post("/:storeId/products", may("catalog:product:write"), async (req, res) => {
    const product = await commands.execute<Sonuc>(
      new CreateProductCommand({ storeId: yol(req, "storeId"), data: req.body }),
      req.context()
    );
    res.status(201).json({ ...product, message: "Ürün eklendi." });
  });

  router.post("/:storeId/products/bulk", may("catalog:product:write"), async (req, res) => {
    const result = await commands.execute<ProductImportResult>(
      new ImportProductsCommand({ storeId: yol(req, "storeId"), rows: req.body?.products }),
      req.context()
    );
    res.status(201).json({
      ...result,
      message: `${result.count} ürün taslak olarak içe aktarıldı. Gözden geçirip yayınlayabilirsiniz.`
    });
  });

  /*
   * Ürün görseli yükleme.
   *
   * Gövde HAM ikili veridir, multipart değil: tek dosya için multipart hem
   * fazladan bir ayrıştırıcı bağımlılığı hem de fazladan bir saldırı yüzeyi
   * demekti. Tarayıcı File nesnesini doğrudan gövdeye koyar.
   *
   * Content-Type allowlist'i burada yalnızca kapıyı daraltır; dosyanın
   * gerçekte ne olduğuna LocalFileStorage baytlara bakarak karar verir.
   */
  router.post(
    "/:storeId/gorseller",
    may("catalog:product:write"),
    raw({ type: ["image/png", "image/jpeg", "image/webp"], limit: "2mb" }),
    async (req, res) => {
      if (!Buffer.isBuffer(req.body)) {
        return res.status(415).json({
          error: "unsupported_media_type",
          message: "Görsel PNG, JPEG ya da WebP olmalı ve ham veri olarak gönderilmeli."
        });
      }
      const result = await commands.execute(
        new UploadProductImageCommand({ storeId: yol(req, "storeId"), content: req.body }),
        req.context()
      );
      res.status(201).json(result);
    }
  );

  router.put("/:storeId/products/:productId", may("catalog:product:write"), async (req, res) => {
    const product = await commands.execute<Sonuc>(
      new UpdateProductCommand({
        storeId: yol(req, "storeId"),
        productId: yol(req, "productId"),
        data: req.body
      }),
      req.context()
    );
    res.json({ ...product, message: "Ürün güncellendi." });
  });

  router.patch("/:storeId/products/:productId/status", may("catalog:product:write"), async (req, res) => {
    const product = await commands.execute(
      new SetProductStatusCommand({
        storeId: yol(req, "storeId"),
        productId: yol(req, "productId"),
        status: req.body?.status
      }),
      req.context()
    );
    res.json(product);
  });

  router.delete("/:storeId/products/:productId", may("catalog:product:delete"), async (req, res) => {
    const result = await commands.execute<ProductDeleteResult>(
      new DeleteProductCommand({ storeId: yol(req, "storeId"), productId: yol(req, "productId") }),
      req.context()
    );
    res.json({
      ...result,
      message: result.archived
        ? "Ürün geçmiş siparişlerde geçtiği için silinmedi, arşive alındı."
        : "Ürün silindi."
    });
  });

  /* ----- siparişler ----- */

  router.get("/:storeId/orders", may("order:read"), async (req, res) => {
    res.json(
      await queries.ask(
        new ListStoreOrdersQuery({ storeId: yol(req, "storeId"), filters: req.query }),
        req.context()
      )
    );
  });

  router.get("/:storeId/orders/:packageId", may("order:read"), async (req, res) => {
    res.json(
      await queries.ask(
        new GetStoreOrderQuery({ storeId: yol(req, "storeId"), packageId: yol(req, "packageId") }),
        req.context()
      )
    );
  });

  router.patch("/:storeId/orders/:packageId/status", may("order:fulfil"), async (req, res) => {
    const result = await commands.execute<Sonuc>(
      new UpdatePackageStatusCommand({
        storeId: yol(req, "storeId"),
        packageId: yol(req, "packageId"),
        status: req.body?.status
      }),
      req.context()
    );
    res.json({ ...result, message: "Paket durumu güncellendi." });
  });

  router.patch("/:storeId/orders/:packageId/shipping", may("order:fulfil"), async (req, res) => {
    const result = await commands.execute<Sonuc>(
      new UpdatePackageShippingCommand({
        storeId: yol(req, "storeId"),
        packageId: yol(req, "packageId"),
        data: req.body
      }),
      req.context()
    );
    res.json({ ...result, message: "Kargo bilgileri kaydedildi." });
  });

  /* ----- çalışanlar ----- */

  router.get("/:storeId/members", may("store:member:manage"), async (req, res) => {
    res.json({
      items: await queries.ask(new ListStoreMembersQuery({ storeId: yol(req, "storeId") }), req.context())
    });
  });

  router.post("/:storeId/members", may("store:member:manage"), async (req, res) => {
    const result = await commands.execute<StoreMemberResult>(
      new ManageStoreMemberCommand({
        storeId: yol(req, "storeId"),
        email: req.body?.email,
        roleCode: req.body?.roleCode,
        remove: req.body?.remove === true
      }),
      req.context()
    );
    res.json({ ...result, message: result.removed ? "Çalışan çıkarıldı." : "Çalışan eklendi." });
  });

  /* ----- destek ----- */

  router.get("/:storeId/tickets", may("support:read"), async (req, res) => {
    res.json(
      await queries.ask(
        new ListTicketsQuery({ scope: "store", storeId: yol(req, "storeId"), filters: req.query }),
        req.context()
      )
    );
  });

  router.get("/:storeId/tickets/:ticketId", may("support:read"), async (req, res) => {
    res.json(
      await queries.ask(
        new GetTicketQuery({ scope: "store", storeId: yol(req, "storeId"), ticketId: yol(req, "ticketId") }),
        req.context()
      )
    );
  });

  router.put("/:storeId/tickets/:ticketId", may("support:respond"), async (req, res) => {
    const result = await commands.execute<Sonuc>(
      new ReplyToTicketCommand({
        ticketId: yol(req, "ticketId"),
        storeId: yol(req, "storeId"),
        data: req.body
      }),
      req.context()
    );
    res.json({ ...result, message: "Talep güncellendi." });
  });

  return router;
}

module.exports = { storePanelRoutes };
