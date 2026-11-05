"use strict";

const { Router } = require("express");

const { LoginAdminCommand, RevokeSessionCommand, TOKEN_TYPES } = require("../../../application/identity");
const {
  CreateProductCommand,
  UpdateProductCommand,
  RemoveProductCommand,
  RestoreProductCommand,
  ImportProductsCommand,
  ListAdminProductsQuery
} = require("../../../application/catalog");
const {
  ChangeOrderStatusCommand,
  UpdateOrderShippingCommand,
  ListAdminOrdersQuery,
  GetAdminStatsQuery
} = require("../../../application/ordering");
const {
  RespondToSupportRequestCommand,
  DeleteSupportRequestCommand,
  ListSupportRequestsQuery,
  GetSupportRequestQuery
} = require("../../../application/support");
const { ADMIN_COOKIE, sessionCookie, clearCookie } = require("../support/cookies");

function adminRoutes({ commands, queries, auth, limiters, config }) {
  const router = Router();
  const secure = config.cookieSecure;

  /* ----- Oturum (koruma gerektirmez) ----- */

  router.get("/session", (req, res) => {
    res.json({ success: true, authenticated: Boolean(req.admin), username: req.admin?.username || null });
  });

  router.post("/login", limiters.adminLogin, async (req, res) => {
    const { token, maxAgeSeconds } = await commands.execute(new LoginAdminCommand(req.body));
    res.setHeader("Set-Cookie", sessionCookie(ADMIN_COOKIE, token, maxAgeSeconds, secure));
    res.json({ success: true, message: "Giriş başarılı." });
  });

  router.post("/logout", async (req, res) => {
    await commands.execute(new RevokeSessionCommand(req.cookies[ADMIN_COOKIE], TOKEN_TYPES.ADMIN));
    res.setHeader("Set-Cookie", clearCookie(ADMIN_COOKIE, secure));
    res.json({ success: true, message: "Çıkış yapıldı." });
  });

  /* ----- Bundan sonrası yönetici oturumu ister ----- */
  router.use(auth.requireAdmin);

  router.get("/stats", async (_req, res) => {
    res.json({ success: true, stats: await queries.ask(new GetAdminStatsQuery()) });
  });

  // Ürünler
  router.get("/products", async (_req, res) => {
    res.json({ success: true, products: await queries.ask(new ListAdminProductsQuery()) });
  });

  router.post("/products", async (req, res) => {
    const product = await commands.execute(new CreateProductCommand(req.body));
    res.status(201).json({ success: true, product, message: "Ürün eklendi." });
  });

  router.post("/products/bulk", async (req, res) => {
    const { count } = await commands.execute(new ImportProductsCommand(req.body?.products));
    res.status(201).json({ success: true, count, message: `${count} ürün içe aktarıldı.` });
  });

  router.put("/products/:id", async (req, res) => {
    const product = await commands.execute(new UpdateProductCommand(req.params.id, req.body));
    res.json({ success: true, product, message: "Ürün güncellendi." });
  });

  router.delete("/products/:id", async (req, res) => {
    const { archived } = await commands.execute(new RemoveProductCommand(req.params.id));
    res.json({
      success: true,
      archived,
      message: archived
        ? "Ürün geçmiş siparişlerde geçtiği için silinmedi, satıştan kaldırıldı."
        : "Ürün silindi."
    });
  });

  router.post("/products/:id/restore", async (req, res) => {
    await commands.execute(new RestoreProductCommand(req.params.id));
    res.json({ success: true, message: "Ürün yeniden satışa alındı." });
  });

  // Siparişler
  router.get("/orders", async (req, res) => {
    const { q, status, from, to, page, pageSize } = req.query;
    const result = await queries.ask(new ListAdminOrdersQuery({ q, status, from, to, page, pageSize }));
    res.json({ success: true, ...result });
  });

  router.patch("/orders/:id/status", async (req, res) => {
    const order = await commands.execute(new ChangeOrderStatusCommand(req.params.id, req.body?.status));
    res.json({ success: true, order, message: "Sipariş durumu güncellendi." });
  });

  router.patch("/orders/:id/shipping", async (req, res) => {
    const order = await commands.execute(new UpdateOrderShippingCommand(req.params.id, req.body));
    res.json({ success: true, order, message: "Kargo bilgileri kaydedildi." });
  });

  // Destek talepleri
  router.get("/support", async (_req, res) => {
    res.json({ success: true, requests: await queries.ask(new ListSupportRequestsQuery()) });
  });

  router.get("/support/:id", async (req, res) => {
    res.json({ success: true, request: await queries.ask(new GetSupportRequestQuery(req.params.id)) });
  });

  router.put("/support/:id", async (req, res) => {
    const { request, emailAttempted, emailSent } = await commands.execute(
      new RespondToSupportRequestCommand(req.params.id, req.body)
    );
    let message = "Talep güncellendi.";
    if (emailAttempted) {
      message = emailSent
        ? "Yanıt kaydedildi ve e-posta gönderildi."
        : "Yanıt kaydedildi; e-posta gönderilemedi veya e-posta ayarları eksik.";
    }
    res.json({ success: true, request, emailSent, message });
  });

  router.delete("/support/:id", async (req, res) => {
    await commands.execute(new DeleteSupportRequestCommand(req.params.id));
    res.json({ success: true, message: "Talep silindi." });
  });

  return router;
}

module.exports = { adminRoutes };
