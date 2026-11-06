"use strict";

import type { Logger, Services } from "../application/shared/contracts";
import type { CommandBus } from "../application/shared/cqrs/bus";
import type { UseCaseContext } from "../application/shared/authorize";

import { ExpireUnpaidOrdersCommand } from "../application/ordering";
import { UNPAID_ORDER_TTL_MINUTES, GUEST_CART_TTL_MS } from "../application/identity/authPolicy";

/**
 * Arka plan bakım işleri. Yalnızca worker sürecinde çalışır; API konteyneri
 * kaç kopya olursa olsun bu işler bir kez yapılır.
 */
export function startScheduler({
  commands,
  unitOfWork,
  logger,
  intervalMs = 5 * 60 * 1000
}: {
  commands: CommandBus<UseCaseContext>;
  unitOfWork: Services["unitOfWork"];
  logger: Logger;
  intervalMs?: number;
}): () => void {
  const jobs: { name: string; run: () => Promise<Record<string, number> | null> }[] = [
    {
      name: "expire-unpaid-orders",
      run: async () => {
        const { expired } = await commands.execute<{ expired: number }>(
          new ExpireUnpaidOrdersCommand({ olderThanMinutes: UNPAID_ORDER_TTL_MINUTES })
        );
        return expired ? { Expired: expired } : null;
      }
    },
    {
      name: "purge-expired-tokens",
      run: async () =>
        unitOfWork.run(async ({ oauth, authSessions, verificationTokens }) => {
          await oauth.purgeExpired();
          await authSessions.purgeExpired();
          await verificationTokens.purgeExpired();
          return null;
        })
    },
    {
      name: "purge-abandoned-carts",
      run: async () =>
        unitOfWork.run(async ({ carts }) => {
          const removed = await carts.purgeAbandonedGuestCarts(new Date(Date.now() - GUEST_CART_TTL_MS));
          return removed ? { Removed: removed } : null;
        })
    }
  ];

  const runAll = async () => {
    for (const job of jobs) {
      try {
        const result = await job.run();
        if (result) logger.info("Bakım işi {Job} çalıştı", { Job: job.name, ...result });
      } catch (error) {
        const mesaj = error instanceof Error ? error.message : String(error);
        logger.error("Bakım işi {Job} başarısız: {Reason}", { Job: job.name, Reason: mesaj });
      }
    }
  };

  const timer = setInterval(runAll, intervalMs);
  timer.unref();
  runAll();

  return () => clearInterval(timer);
}

