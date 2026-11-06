"use strict";

const { Router } = require("express");
const { CheckReadinessQuery } = require("../../../application/system");

function healthRoutes({ queries }) {
  const router = Router();

  // Canlılık: süreç ayakta mı? (Docker healthcheck bunu kullanır)
  router.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "donanex-api" });
  });

  // Hazırlık: bağımlılıklar (veritabanı, önbellek) yanıt veriyor mu?
  router.get("/ready", async (_req, res) => {
    const result = await queries.ask(new CheckReadinessQuery());
    res.status(result.ready ? 200 : 503).json(result);
  });

  return router;
}

module.exports = { healthRoutes };
