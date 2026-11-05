"use strict";

const { Router } = require("express");
const {
  RegisterCustomerCommand,
  LoginCustomerCommand,
  SaveCustomerAddressCommand,
  UpdateCustomerProfileCommand,
  ChangeCustomerPasswordCommand,
  RequestPasswordResetCommand,
  ResetPasswordCommand,
  GetCustomerProfileQuery,
  GetCustomerAddressQuery
} = require("../../../application/customers");
const { ListCustomerOrdersQuery, CancelCustomerOrderCommand } = require("../../../application/ordering");
const { RevokeSessionCommand, TOKEN_TYPES } = require("../../../application/identity");
const { CUSTOMER_COOKIE, sessionCookie, clearCookie } = require("../support/cookies");

function customerRoutes({ commands, queries, auth, limiters, config }) {
  const router = Router();
  const secure = config.cookieSecure;

  /* ----- Kayıt ve oturum ----- */

  router.post("/register", limiters.registration, async (req, res) => {
    await commands.execute(new RegisterCustomerCommand(req.body));
    res.status(201).json({ success: true, message: "Kayıt başarılı. Şimdi giriş yapabilirsin." });
  });

  router.post("/login", limiters.customerLogin, async (req, res) => {
    const { token, maxAgeSeconds, customer } = await commands.execute(new LoginCustomerCommand(req.body));
    res.setHeader("Set-Cookie", sessionCookie(CUSTOMER_COOKIE, token, maxAgeSeconds, secure));
    res.json({ success: true, message: "Giriş başarılı.", customer });
  });

  router.get("/session", async (req, res) => {
    const customer = req.customer ? await queries.ask(new GetCustomerProfileQuery(req.customer.customerId)) : null;
    res.json({ success: true, authenticated: Boolean(customer), customer });
  });

  router.post("/logout", async (req, res) => {
    await commands.execute(new RevokeSessionCommand(req.cookies[CUSTOMER_COOKIE], TOKEN_TYPES.CUSTOMER));
    res.setHeader("Set-Cookie", clearCookie(CUSTOMER_COOKIE, secure));
    res.json({ success: true, message: "Çıkış yapıldı." });
  });

  /* ----- Parola sıfırlama ----- */

  router.post("/password/forgot", limiters.passwordReset, (req, res) => {
    // Yanıt işlemi beklemez ve her zaman aynıdır: e-postanın kayıtlı olup olmadığı anlaşılmaz.
    commands.execute(new RequestPasswordResetCommand(req.body?.email)).catch((error) => {
      console.error("Parola sıfırlama isteği işlenemedi:", error.message);
    });
    res.json({
      success: true,
      message: "Bu e-posta kayıtlıysa sıfırlama bağlantısı gönderildi. Gelen kutunu kontrol et."
    });
  });

  router.post("/password/reset", limiters.passwordReset, async (req, res) => {
    await commands.execute(new ResetPasswordCommand(req.body?.token, req.body?.password));
    res.json({ success: true, message: "Parolan güncellendi. Şimdi giriş yapabilirsin." });
  });

  /* ----- Bundan sonrası müşteri oturumu ister ----- */

  router.put("/profile", auth.requireCustomer, async (req, res) => {
    const { name } = await commands.execute(new UpdateCustomerProfileCommand(req.customer.customerId, req.body));
    res.json({ success: true, name, message: "Bilgilerin güncellendi." });
  });

  router.put("/password", auth.requireCustomer, limiters.passwordChange, async (req, res) => {
    const { token, maxAgeSeconds } = await commands.execute(
      new ChangeCustomerPasswordCommand(req.customer.customerId, req.body)
    );
    res.setHeader("Set-Cookie", sessionCookie(CUSTOMER_COOKIE, token, maxAgeSeconds, secure));
    res.json({ success: true, message: "Şifren değiştirildi. Diğer cihazlardaki oturumlar kapatıldı." });
  });

  router.get("/address", auth.requireCustomer, async (req, res) => {
    const address = await queries.ask(new GetCustomerAddressQuery(req.customer.customerId));
    res.json({ success: true, address });
  });

  router.put("/address", auth.requireCustomer, async (req, res) => {
    await commands.execute(new SaveCustomerAddressCommand(req.customer.customerId, req.body));
    res.json({ success: true, message: "Adresiniz kaydedildi." });
  });

  router.get("/orders", auth.requireCustomer, async (req, res) => {
    const orders = await queries.ask(new ListCustomerOrdersQuery(req.customer.customerId));
    res.json({ success: true, orders });
  });

  router.post("/orders/:id/cancel", auth.requireCustomer, async (req, res) => {
    const order = await commands.execute(new CancelCustomerOrderCommand(req.customer.customerId, req.params.id));
    res.json({ success: true, order, message: "Siparişin iptal edildi." });
  });

  return router;
}

module.exports = { customerRoutes };
