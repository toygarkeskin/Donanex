"use strict";

const { Router } = require("express");
const { OpenTicketCommand } = require("../../../application/support");

/** Destek talebi açma. Kayıtsız kullanıcı da kullanabilir. */
function supportRoutes({ commands, limiters }) {
  const router = Router();

  router.post("/support/tickets", limiters.support, async (req, res) => {
    const ticket = await commands.execute(
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

module.exports = { supportRoutes };
