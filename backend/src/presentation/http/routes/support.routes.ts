"use strict";

import type { RouteContext } from "../types";
import type { TicketResult } from "../support/results";

import { Router } from "express";
import { OpenTicketCommand } from "../../../application/support";

/** Destek talebi açma. Kayıtsız kullanıcı da kullanabilir. */
export function supportRoutes({ commands, limiters }: Pick<RouteContext, "commands" | "limiters">): Router {
  const router = Router();

  router.post("/support/tickets", limiters.support, async (req, res) => {
    const ticket = await commands.execute<TicketResult>(
      new OpenTicketCommand({ userId: req.auth?.userId ?? null, data: req.body }),
      req.context()
    );
    res.status(201).json({
      id: ticket.id,
      reference: ticket.reference,
      message: `Talebiniz alındı. Talep numaranız: ${ticket.reference}`
    });
  });

  return router;
}

