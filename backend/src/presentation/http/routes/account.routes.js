"use strict";

const { Router } = require("express");
const {
  GetCurrentUserQuery,
  UpdateProfileCommand,
  ChangePasswordCommand,
  SaveAddressCommand,
  DeleteAddressCommand,
  ListAddressesQuery
} = require("../../../application/identity");
const {
  ListMyOrdersQuery,
  GetMyOrderQuery,
  CancelOrderCommand
} = require("../../../application/ordering");
const { ApplyForStoreCommand } = require("../../../application/stores");
const { ListTicketsQuery, GetTicketQuery } = require("../../../application/support");
const { requireAuth } = require("../middleware/authenticate");
const { COOKIES, buildCookie, appendCookie } = require("../support/cookies");

/** Kullanıcının kendi hesabı. Tüm uçlar yalnızca kendi verisine erişir. */
function accountRoutes({ commands, queries, config, limiters }) {
  const router = Router();
  router.use(requireAuth);

  router.get("/", async (req, res) => {
    res.json(await queries.ask(new GetCurrentUserQuery({ userId: req.auth.userId }), req.context()));
  });

  router.put("/profile", async (req, res) => {
    const profile = await commands.execute(
      new UpdateProfileCommand({ userId: req.auth.userId, data: req.body }),
      req.context()
    );
    res.json({ ...profile, message: "Bilgileriniz güncellendi." });
  });

  router.put("/password", limiters.passwordChange, async (req, res) => {
    const { session } = await commands.execute(
      new ChangePasswordCommand({
        userId: req.auth.userId,
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
    res.json({ items: await queries.ask(new ListAddressesQuery({ userId: req.auth.userId })) });
  });

  router.post("/addresses", async (req, res) => {
    const address = await commands.execute(
      new SaveAddressCommand({ userId: req.auth.userId, data: req.body }),
      req.context()
    );
    res.status(201).json(address);
  });

  router.put("/addresses/:addressId", async (req, res) => {
    const address = await commands.execute(
      new SaveAddressCommand({ userId: req.auth.userId, addressId: req.params.addressId, data: req.body }),
      req.context()
    );
    res.json(address);
  });

  router.delete("/addresses/:addressId", async (req, res) => {
    await commands.execute(
      new DeleteAddressCommand({ userId: req.auth.userId, addressId: req.params.addressId }),
      req.context()
    );
    res.status(204).end();
  });

  /* ----- siparişler ----- */

  router.get("/orders", async (req, res) => {
    res.json(await queries.ask(new ListMyOrdersQuery({ userId: req.auth.userId, filters: req.query })));
  });

  router.get("/orders/:orderId", async (req, res) => {
    res.json(await queries.ask(new GetMyOrderQuery({ userId: req.auth.userId, orderId: req.params.orderId })));
  });

  router.post("/orders/:orderId/cancel", async (req, res) => {
    const result = await commands.execute(
      new CancelOrderCommand({ userId: req.auth.userId, orderId: req.params.orderId }),
      req.context()
    );
    res.json({ ...result, message: "Siparişiniz iptal edildi." });
  });

  /* ----- destek ----- */

  router.get("/tickets", async (req, res) => {
    res.json(
      await queries.ask(
        new ListTicketsQuery({ scope: "mine", userId: req.auth.userId, filters: req.query }),
        req.context()
      )
    );
  });

  router.get("/tickets/:ticketId", async (req, res) => {
    res.json(
      await queries.ask(
        new GetTicketQuery({ scope: "mine", userId: req.auth.userId, ticketId: req.params.ticketId }),
        req.context()
      )
    );
  });

  /* ----- mağaza başvurusu ----- */

  router.post("/store-application", limiters.storeApplication, async (req, res) => {
    const store = await commands.execute(
      new ApplyForStoreCommand({ userId: req.auth.userId, data: req.body }),
      req.context()
    );
    res.status(201).json({
      store,
      message: "Başvurunuz alındı. Yönetici onayından sonra satışa başlayabilirsiniz."
    });
  });

  return router;
}

module.exports = { accountRoutes };
