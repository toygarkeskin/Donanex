"use strict";

const { ExpireUnpaidOrdersCommand } = require("../application/ordering");

const INTERVAL_MS = 5 * 60 * 1000;

/** Arka plan işleri. Durdurma fonksiyonu döndürür. */
function startScheduler({ commands, config }) {
  const run = async () => {
    try {
      const { expired } = await commands.execute(new ExpireUnpaidOrdersCommand(config.orderPaymentTtlMinutes));
      if (expired) console.log(`Süresi dolan ${expired} ödenmemiş sipariş iptal edildi.`);
    } catch (error) {
      console.error("Zamanlanmış iş başarısız:", error.message);
    }
  };

  const timer = setInterval(run, INTERVAL_MS);
  timer.unref();
  run();

  return () => clearInterval(timer);
}

module.exports = { startScheduler };
