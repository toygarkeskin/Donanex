"use strict";

const { Router } = require("express");
const { CreateSupportRequestCommand } = require("../../../application/support");

function supportRoutes({ commands, limiters }) {
  const router = Router();

  router.post("/support", limiters.support, async (req, res) => {
    const request = await commands.execute(new CreateSupportRequestCommand(req.body));
    res.status(201).json({ success: true, message: "Destek talebiniz alındı.", request });
  });

  return router;
}

module.exports = { supportRoutes };
