"use strict";

const { Router } = require("express");
const { CheckReadinessQuery } = require("../../../application/system");

function healthRoutes({ queries }) {
  const router = Router();

  // Canlılık: süreç ayakta mı? (Docker healthcheck)
  router.get("/health", (_req, res) => {
    res.json({ success: true, message: "Backend sunucusu çalışıyor." });
  });

  // Hazırlık: veritabanına ulaşılabiliyor mu?
  router.get("/ready", async (_req, res) => {
    const ready = await queries.ask(new CheckReadinessQuery());
    res.status(ready ? 200 : 503).json({ success: ready });
  });

  return router;
}

module.exports = { healthRoutes };
