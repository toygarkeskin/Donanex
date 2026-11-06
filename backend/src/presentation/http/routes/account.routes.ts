"use strict";

import type { RouteContext } from "../types";
import type { ChangePasswordResult, Sonuc } from "../support/results";

import { kullanici, yol } from "../support/params";
import { Router } from "express";
import {
  GetCurrentUserQuery,
  UpdateProfileCommand,
  ChangePasswordCommand,
  SaveAddressCommand,
  DeleteAddressCommand,
  ListAddressesQuery
} from "../../../application/identity";
import {
  ListMyOrdersQuery,
  GetMyOrderQuery,
  CancelOrderCommand
} from "../../../application/ordering";
import { ApplyForStoreCommand } from "../../../application/stores";
import { ListTicketsQuery, GetTicketQuery } from "../../../application/support";
import { requireAuth } from "../middleware/authenticate";
import { COOKIES, buildCookie, appendCookie } from "../support/cookies";

/** Kullanıcının kendi hesabı. Tüm uçlar yalnızca kendi verisine erişir. */
export function accountRoutes({ commands, queries, config, limiters }: Pick<RouteContext, "commands" | "queries" | "config" | "limiters">): Router {
  const router = Router();
  router.use(requireAuth);

  router.get("/", async (req, res) => {
    res.json(await queries.ask(new GetCurrentUserQuery({ userId: kullanici(req) }), req.context()));
  });

  router.put("/profile", async (req, res) => {
    const profile = await commands.execute<Sonuc>(
      new UpdateProfileCommand({ userId: kullanici(req), data: req.body }),
      req.context()
    );
    res.json({ ...profile, message: "Bilgileriniz güncellendi." });
  });

  router.put("/password", limiters.passwordChange, async (req, res) => {
    const { session } = await commands.execute<ChangePasswordResult>(
      new ChangePasswordCommand({
        userId: kullanici(req),
        currentPassword: req.body?.currentPassword,
        newPassword: req.body?.newPassword
      }),
      req.context()
    );
    // Bu cihaz oturumda kalır, diğerleri düşer.
    appendCookie(
      res,
      buildCookie(COOKIES.SSO, session.token, {
        maxAgeSeconds: session.maxAgeSeconds,
        secure: config.cookieSecure,
        sameSite: "Lax"
      })
    );
    res.json({
      message: "Parolanız değiştirildi. Diğer cihazlardaki oturumlarınız kapatıldı.",
      reauthenticate: true
    });
  });

  /* ----- adresler ----- */

  router.get("/addresses", async (req, res) => {
    res.json({ items: await queries.ask(new ListAddressesQuery({ userId: kullanici(req) })) });
  });

  router.post("/addresses", async (req, res) => {
    const address = await commands.execute(
      new SaveAddressCommand({ userId: kullanici(req), data: req.body }),
      req.context()
    );
    res.status(201).json(address);
  });

  router.put("/addresses/:addressId", async (req, res) => {
    const address = await commands.execute(
      new SaveAddressCommand({ userId: kullanici(req), addressId: yol(req, "addressId"), data: req.body }),
      req.context()
    );
    res.json(address);
  });

  router.delete("/addresses/:addressId", async (req, res) => {
    await commands.execute(
      new DeleteAddressCommand({ userId: kullanici(req), addressId: yol(req, "addressId") }),
      req.context()
    );
    res.status(204).end();
  });

  /* ----- siparişler ----- */

  router.get("/orders", async (req, res) => {
    res.json(await queries.ask(new ListMyOrdersQuery({ userId: kullanici(req), filters: req.query })));
  });

  router.get("/orders/:orderId", async (req, res) => {
    res.json(await queries.ask(new GetMyOrderQuery({ userId: kullanici(req), orderId: yol(req, "orderId") })));
  });

  router.post("/orders/:orderId/cancel", async (req, res) => {
    const result = await commands.execute<Sonuc>(
      new CancelOrderCommand({ userId: kullanici(req), orderId: yol(req, "orderId") }),
      req.context()
    );
    res.json({ ...result, message: "Siparişiniz iptal edildi." });
  });

  /* ----- destek ----- */

  router.get("/tickets", async (req, res) => {
    res.json(
      await queries.ask(
        new ListTicketsQuery({ scope: "mine", userId: kullanici(req), filters: req.query }),
        req.context()
      )
    );
  });

  router.get("/tickets/:ticketId", async (req, res) => {
    res.json(
      await queries.ask(
        new GetTicketQuery({ scope: "mine", userId: kullanici(req), ticketId: yol(req, "ticketId") }),
        req.context()
      )
    );
  });

  /* ----- mağaza başvurusu ----- */

  router.post("/store-application", limiters.storeApplication, async (req, res) => {
    const store = await commands.execute(
      new ApplyForStoreCommand({ userId: kullanici(req), data: req.body }),
      req.context()
    );
    res.status(201).json({
      store,
      message: "Başvurunuz alındı. Yönetici onayından sonra satışa başlayabilirsiniz."
    });
  });

  return router;
}

