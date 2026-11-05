"use strict";

const { Router } = require("express");
const {
  CreateProductCommand,
  UpdateProductCommand,
  SetProductStatusCommand,
  DeleteProductCommand,
  ImportProductsCommand,
  ListStoreProductsQuery
} = require("../../../application/catalog");
const {
  ListStoreOrdersQuery,
  GetStoreOrderQuery,
  UpdatePackageStatusCommand,
  UpdatePackageShippingCommand
} = require("../../../application/ordering");
const {
  GetStoreForMemberQuery,
  UpdateStoreCommand,
  ListStoreMembersQuery,
  ManageStoreMemberCommand
} = require("../../../application/stores");
const { ListTicketsQuery, GetTicketQuery, ReplyToTicketCommand } = require("../../../application/support");
const { GetDashboardQuery } = require("../../../application/system");
const { requireAuth, requirePermission } = require("../middleware/authenticate");

/**
 * Mağaza paneli. Her uç mağazaya göre kapsamlıdır: yetki denetimi
 * "bu kişi BU mağazada şunu yapabilir mi?" sorusunu sorar, böylece bir mağaza
 * sahibi başka bir mağazanın verisine hiçbir yoldan erişemez.
 */
function storePanelRoutes({ commands, queries }) {
  const router = Router();
  const inStore = (req) => ({ storeId: req.params.storeId });
  const may = (permission) => requirePermission(permission, inStore);

  router.use(requireAuth);

  router.get("/:storeId", may("store:read"), async (req, res) => {
    res.json(await queries.ask(new GetStoreForMemberQuery({ storeId: req.params.storeId }), req.context()));
  });

  router.put("/:storeId", may("store:write"), async (req, res) => {
    const store = await commands.execute(
      new UpdateStoreCommand({ storeId: req.params.storeId, data: req.body }),
      req.context()
    );
    res.json({ ...store, message: "Mağaza bilgileri güncellendi." });
  });

  router.get("/:storeId/dashboard", may("order:read"), async (req, res) => {
    res.json(await queries.ask(new GetDashboardQuery({ scope: "store", storeId: req.params.storeId }), req.context()));
  });

  /* ----- ürünler ----- */

  router.get("/:storeId/products", may("catalog:product:read"), async (req, res) => {
    res.json(
      await queries.ask(
        new ListStoreProductsQuery({ storeId: req.params.storeId, filters: req.query }),
        req.context()
      )
    );
  });

  router.post("/:storeId/products", may("catalog:product:write"), async (req, res) => {
    const product = await commands.execute(
      new CreateProductCommand({ storeId: req.params.storeId, data: req.body }),
      req.context()
    );
    res.status(201).json({ ...product, message: "Ürün eklendi." });
  });

  router.post("/:storeId/products/bulk", may("catalog:product:write"), async (req, res) => {
    const result = await commands.execute(
      new ImportProductsCommand({ storeId: req.params.storeId, rows: req.body?.products }),
      req.context()
    );
    res.status(201).json({
      ...result,
      message: `${result.count} ürün taslak olarak içe aktarıldı. Gözden geçirip yayınlayabilirsiniz.`
    });
  });

  router.put("/:storeId/products/:productId", may("catalog:product:write"), async (req, res) => {
    const product = await commands.execute(
      new UpdateProductCommand({
        storeId: req.params.storeId,
        productId: req.params.productId,
        data: req.body
      }),
      req.context()
    );
    res.json({ ...product, message: "Ürün güncellendi." });
  });

  router.patch("/:storeId/products/:productId/status", may("catalog:product:write"), async (req, res) => {
    const product = await commands.execute(
      new SetProductStatusCommand({
        storeId: req.params.storeId,
        productId: req.params.productId,
        status: req.body?.status
      }),
      req.context()
    );
    res.json(product);
  });

  router.delete("/:storeId/products/:productId", may("catalog:product:delete"), async (req, res) => {
    const result = await commands.execute(
      new DeleteProductCommand({ storeId: req.params.storeId, productId: req.params.productId }),
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
        new ListStoreOrdersQuery({ storeId: req.params.storeId, filters: req.query }),
        req.context()
      )
    );
  });

  router.get("/:storeId/orders/:packageId", may("order:read"), async (req, res) => {
    res.json(
      await queries.ask(
        new GetStoreOrderQuery({ storeId: req.params.storeId, packageId: req.params.packageId }),
        req.context()
      )
    );
  });

  router.patch("/:storeId/orders/:packageId/status", may("order:fulfil"), async (req, res) => {
    const result = await commands.execute(
      new UpdatePackageStatusCommand({
        storeId: req.params.storeId,
        packageId: req.params.packageId,
        status: req.body?.status
      }),
      req.context()
    );
    res.json({ ...result, message: "Paket durumu güncellendi." });
  });

  router.patch("/:storeId/orders/:packageId/shipping", may("order:fulfil"), async (req, res) => {
    const result = await commands.execute(
      new UpdatePackageShippingCommand({
        storeId: req.params.storeId,
        packageId: req.params.packageId,
        data: req.body
      }),
      req.context()
    );
    res.json({ ...result, message: "Kargo bilgileri kaydedildi." });
  });

  /* ----- çalışanlar ----- */

  router.get("/:storeId/members", may("store:member:manage"), async (req, res) => {
    res.json({
      items: await queries.ask(new ListStoreMembersQuery({ storeId: req.params.storeId }), req.context())
    });
  });

  router.post("/:storeId/members", may("store:member:manage"), async (req, res) => {
    const result = await commands.execute(
      new ManageStoreMemberCommand({
        storeId: req.params.storeId,
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
        new ListTicketsQuery({ scope: "store", storeId: req.params.storeId, filters: req.query }),
        req.context()
      )
    );
  });

  router.get("/:storeId/tickets/:ticketId", may("support:read"), async (req, res) => {
    res.json(
      await queries.ask(
        new GetTicketQuery({ scope: "store", storeId: req.params.storeId, ticketId: req.params.ticketId }),
        req.context()
      )
    );
  });

  router.put("/:storeId/tickets/:ticketId", may("support:respond"), async (req, res) => {
    const result = await commands.execute(
      new ReplyToTicketCommand({
        ticketId: req.params.ticketId,
        storeId: req.params.storeId,
        data: req.body
      }),
      req.context()
    );
    res.json({ ...result, message: "Talep güncellendi." });
  });

  return router;
}

module.exports = { storePanelRoutes };
