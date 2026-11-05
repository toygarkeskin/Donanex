"use strict";

const { Router } = require("express");
const {
  ListUsersQuery,
  AssignRoleCommand,
  SetUserStatusCommand
} = require("../../../application/identity");
const {
  ListStoresForAdminQuery,
  SetStoreStatusCommand
} = require("../../../application/stores");
const { CreateCategoryCommand } = require("../../../application/catalog");
const { ListAdminOrdersQuery, GetAdminOrderQuery } = require("../../../application/ordering");
const { ListTicketsQuery, GetTicketQuery, ReplyToTicketCommand } = require("../../../application/support");
const { GetDashboardQuery } = require("../../../application/system");
const { requireAuth, requirePermission } = require("../middleware/authenticate");

/** Sistem yöneticisi paneli. Her uç ayrı ayrı izin ister. */
function adminRoutes({ commands, queries }) {
  const router = Router();
  router.use(requireAuth);

  router.get("/dashboard", requirePermission("system:settings"), async (req, res) => {
    res.json(await queries.ask(new GetDashboardQuery({ scope: "admin" }), req.context()));
  });

  /* ----- kullanıcılar ve roller ----- */

  router.get("/users", requirePermission("user:read"), async (req, res) => {
    res.json(await queries.ask(new ListUsersQuery(req.query), req.context()));
  });

  router.post("/users/:userId/roles", requirePermission("role:assign"), async (req, res) => {
    const result = await commands.execute(
      new AssignRoleCommand({
        userId: req.params.userId,
        roleCode: req.body?.roleCode,
        storeId: req.body?.storeId ?? null,
        revoke: req.body?.revoke === true
      }),
      req.context()
    );
    res.json({ ...result, message: result.revoked ? "Rol kaldırıldı." : "Rol atandı." });
  });

  router.patch("/users/:userId/status", requirePermission("user:write"), async (req, res) => {
    const result = await commands.execute(
      new SetUserStatusCommand({ userId: req.params.userId, status: req.body?.status }),
      req.context()
    );
    res.json({ ...result, message: "Hesap durumu güncellendi." });
  });

  /* ----- mağazalar ----- */

  router.get("/stores", requirePermission("store:approve"), async (req, res) => {
    res.json(await queries.ask(new ListStoresForAdminQuery(req.query), req.context()));
  });

  router.patch("/stores/:storeId/status", requirePermission("store:approve"), async (req, res) => {
    const result = await commands.execute(
      new SetStoreStatusCommand({ storeId: req.params.storeId, status: req.body?.status }),
      req.context()
    );
    res.json({ ...result, message: "Mağaza durumu güncellendi." });
  });

  /* ----- kategoriler ----- */

  router.post("/categories", requirePermission("catalog:category:manage"), async (req, res) => {
    const category = await commands.execute(new CreateCategoryCommand({ data: req.body }), req.context());
    res.status(201).json(category);
  });

  /* ----- siparişler ----- */

  router.get("/orders", requirePermission("order:read"), async (req, res) => {
    res.json(await queries.ask(new ListAdminOrdersQuery(req.query), req.context()));
  });

  router.get("/orders/:orderId", requirePermission("order:read"), async (req, res) => {
    res.json(await queries.ask(new GetAdminOrderQuery({ orderId: req.params.orderId }), req.context()));
  });

  /* ----- destek ----- */

  router.get("/tickets", requirePermission("support:read"), async (req, res) => {
    res.json(await queries.ask(new ListTicketsQuery({ scope: "admin", filters: req.query }), req.context()));
  });

  router.get("/tickets/:ticketId", requirePermission("support:read"), async (req, res) => {
    res.json(
      await queries.ask(new GetTicketQuery({ scope: "admin", ticketId: req.params.ticketId }), req.context())
    );
  });

  router.put("/tickets/:ticketId", requirePermission("support:respond"), async (req, res) => {
    const result = await commands.execute(
      new ReplyToTicketCommand({ ticketId: req.params.ticketId, data: req.body }),
      req.context()
    );
    res.json({ ...result, message: "Talep güncellendi." });
  });

  return router;
}

module.exports = { adminRoutes };
