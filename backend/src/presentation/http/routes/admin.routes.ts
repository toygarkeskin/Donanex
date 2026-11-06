"use strict";

import type { RouteContext } from "../types";
import type { RoleAssignmentResult, Sonuc } from "../support/results";

import { yol } from "../support/params";
import { Router } from "express";
import {
  ListUsersQuery,
  AssignRoleCommand,
  SetUserStatusCommand
} from "../../../application/identity";
import {
  ListStoresForAdminQuery,
  SetStoreStatusCommand
} from "../../../application/stores";
import { CreateCategoryCommand } from "../../../application/catalog";
import { ListAdminOrdersQuery, GetAdminOrderQuery } from "../../../application/ordering";
import { ListTicketsQuery, GetTicketQuery, ReplyToTicketCommand } from "../../../application/support";
import { GetDashboardQuery } from "../../../application/system";
import { requireAuth, requirePermission } from "../middleware/authenticate";

/** Sistem yöneticisi paneli. Her uç ayrı ayrı izin ister. */
export function adminRoutes({ commands, queries }: Pick<RouteContext, "commands" | "queries">): Router {
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
    const result = await commands.execute<RoleAssignmentResult>(
      new AssignRoleCommand({
        userId: yol(req, "userId"),
        roleCode: req.body?.roleCode,
        storeId: req.body?.storeId ?? null,
        revoke: req.body?.revoke === true
      }),
      req.context()
    );
    res.json({ ...result, message: result.revoked ? "Rol kaldırıldı." : "Rol atandı." });
  });

  router.patch("/users/:userId/status", requirePermission("user:write"), async (req, res) => {
    const result = await commands.execute<Sonuc>(
      new SetUserStatusCommand({ userId: yol(req, "userId"), status: req.body?.status }),
      req.context()
    );
    res.json({ ...result, message: "Hesap durumu güncellendi." });
  });

  /* ----- mağazalar ----- */

  router.get("/stores", requirePermission("store:approve"), async (req, res) => {
    res.json(await queries.ask(new ListStoresForAdminQuery(req.query), req.context()));
  });

  router.patch("/stores/:storeId/status", requirePermission("store:approve"), async (req, res) => {
    const result = await commands.execute<Sonuc>(
      new SetStoreStatusCommand({ storeId: yol(req, "storeId"), status: req.body?.status }),
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
    res.json(await queries.ask(new GetAdminOrderQuery({ orderId: yol(req, "orderId") }), req.context()));
  });

  /* ----- destek ----- */

  router.get("/tickets", requirePermission("support:read"), async (req, res) => {
    res.json(await queries.ask(new ListTicketsQuery({ scope: "admin", filters: req.query }), req.context()));
  });

  router.get("/tickets/:ticketId", requirePermission("support:read"), async (req, res) => {
    res.json(
      await queries.ask(new GetTicketQuery({ scope: "admin", ticketId: yol(req, "ticketId") }), req.context())
    );
  });

  router.put("/tickets/:ticketId", requirePermission("support:respond"), async (req, res) => {
    const result = await commands.execute<Sonuc>(
      new ReplyToTicketCommand({ ticketId: yol(req, "ticketId"), data: req.body }),
      req.context()
    );
    res.json({ ...result, message: "Talep güncellendi." });
  });

  return router;
}

