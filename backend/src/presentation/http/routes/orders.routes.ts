"use strict";

import type { RouteContext } from "../types";
import type { Sonuc } from "../support/results";

import { yol } from "../support/params";
import { Router } from "express";
import {
  PlaceOrderCommand,
  ProcessPaymentCommand,
  TrackOrderQuery
} from "../../../application/ordering";
import { COOKIES, clearCookie, appendCookie } from "../support/cookies";

/**
 * Sipariş verme ve ödeme.
 *
 * KAYIT ZORUNLU DEĞİLDİR: misafir de sipariş verebilir ve takip kodu alır.
 * Yanıtta kullanıcıya kayıt olabileceği hatırlatılır.
 */
export function orderRoutes({ commands, queries, config, limiters }: Pick<RouteContext, "commands" | "queries" | "config" | "limiters">): Router {
  const router = Router();

  router.post("/orders", limiters.checkout, async (req, res) => {
    const result = await commands.execute<Sonuc>(
      new PlaceOrderCommand({
        userId: req.auth?.userId ?? null,
        guestCartId: req.guestCartId,
        checkout: req.body
      }),
      req.context()
    );

    // Sepet siparişe dönüştü; misafir çerezi artık boş bir sepeti gösteriyor.
    appendCookie(res, clearCookie(COOKIES.CART, { secure: config.cookieSecure, sameSite: "Lax" }));

    res.status(201).json({
      ...result,
      // Kayıtsız alışverişte hesabın faydasını hatırlat (zorlamadan).
      registrationHint: req.auth?.userId
        ? null
        : "Hesap oluşturursanız siparişlerinizi takip kodu olmadan görebilir, adreslerinizi kaydedebilirsiniz."
    });
  });

  /**
   * Ödeme benzetimi. Gerçek para hareketi yoktur ve yalnızca
   * PAYMENTS_MODE=simulated iken açıktır. Erişim, siparişin sahibi olmakla
   * ya da takip kodunu bilmekle kanıtlanır.
   */
  router.post("/orders/:orderId/payment", limiters.checkout, async (req, res) => {
    const result = await commands.execute(
      new ProcessPaymentCommand({
        orderId: yol(req, "orderId"),
        trackingCode: req.body?.trackingCode ?? null,
        userId: req.auth?.userId ?? null,
        outcome: req.body?.outcome
      }),
      req.context()
    );
    res.json(result);
  });

  /** Misafir takibi: sipariş numarası + takip kodu. Kişisel veri dönmez. */
  router.post("/orders/track", limiters.tracking, async (req, res) => {
    const order = await queries.ask(
      new TrackOrderQuery({ orderNumber: req.body?.orderNumber, trackingCode: req.body?.trackingCode })
    );
    res.json(order);
  });

  return router;
}

