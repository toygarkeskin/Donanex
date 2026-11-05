"use strict";

const { Router } = require("express");
const {
  PlaceOrderCommand,
  RecordTestPaymentCommand,
  GetOrderPaymentSummaryQuery,
  TrackOrderQuery
} = require("../../../application/ordering");

function orderRoutes({ commands, queries, limiters, config }) {
  const router = Router();

  /** Test uçları, ayarla açılmadıkça yok sayılır. */
  function requireTestPayments(_req, res, next) {
    if (!config.testPaymentsEnabled) return res.status(404).json({ success: false, message: "Bulunamadı." });
    next();
  }

  router.post("/orders", limiters.orders, async (req, res) => {
    const result = await commands.execute(new PlaceOrderCommand(req.body, req.customer?.customerId || null));
    res.status(201).json({ success: true, message: "Sipariş oluşturuldu.", ...result });
  });

  // TEST ÖDEME SİSTEMİ - GERÇEK ÖDEME ALMAZ. Takip kodu sahiplik kanıtıdır.
  router.post("/orders/:id/payment-summary", requireTestPayments, limiters.tracking, async (req, res) => {
    const order = await queries.ask(new GetOrderPaymentSummaryQuery(req.params.id, req.body?.trackingCode));
    res.json({ success: true, order });
  });

  router.post("/orders/:id/test-payment", requireTestPayments, limiters.tracking, async (req, res) => {
    const order = await commands.execute(
      new RecordTestPaymentCommand(req.params.id, req.body?.trackingCode, req.body?.successful)
    );
    res.json({ success: true, message: "Test sonucu kaydedildi. Gerçek ödeme alınmadı.", order });
  });

  // Müşteri sipariş takibi: sipariş numarası + takip kodu
  router.post("/order-tracking", limiters.tracking, async (req, res) => {
    const { orderId, trackingCode } = req.body || {};
    const order = await queries.ask(new TrackOrderQuery(orderId, trackingCode));
    res.json({ success: true, order });
  });

  return router;
}

module.exports = { orderRoutes };
