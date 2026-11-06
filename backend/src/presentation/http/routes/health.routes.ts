"use strict";

import type { RouteContext } from "../types";
import type { ReadinessResult } from "../support/results";

import { Router } from "express";
import { CheckReadinessQuery } from "../../../application/system";

export function healthRoutes({ queries }: Pick<RouteContext, "queries">): Router {
  const router = Router();

  // Canlılık: süreç ayakta mı? (Docker healthcheck bunu kullanır)
  router.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "donanex-api" });
  });

  // Hazırlık: bağımlılıklar (veritabanı, önbellek) yanıt veriyor mu?
  router.get("/ready", async (_req, res) => {
    const result = await queries.ask<ReadinessResult>(new CheckReadinessQuery());
    res.status(result.ready ? 200 : 503).json(result);
  });

  return router;
}

