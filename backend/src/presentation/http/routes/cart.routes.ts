"use strict";

import type { RouteContext } from "../types";
import type { CartMutationResult } from "../support/results";

import { yol } from "../support/params";
import { Router, type Request, type Response } from "express";
import {
  GetCartQuery,
  AddToCartCommand,
  UpdateCartItemCommand,
  RemoveFromCartCommand,
  ClearCartCommand
} from "../../../application/ordering";
import { AdoptGuestCartCommand } from "../../../application/identity";
import { COOKIES, appendCookie, clearCookie } from "../support/cookies";

/**
 * Sepet. GİRİŞ GEREKTİRMEZ.
 *
 * Kayıtsız kullanıcının sepeti de sunucuda tutulur; tarayıcıda yalnızca
 * sepet kimliği (HttpOnly çerez) bulunur. Kullanıcı sonradan giriş yaparsa
 * ya da kayıt olursa sepet kendi hesabına taşınır ve hiçbir ürün kaybolmaz.
 */
export function cartRoutes({ commands, queries, config }: Pick<RouteContext, "commands" | "queries" | "config">): Router {
  const router = Router();

  /*
   * Oturum açık ama tarayıcıda misafir sepeti çerezi kalmış: giriş adımı
   * atlanmış (açık oturumla sessiz yetkilendirme) ve sepet taşınmamış demek.
   * Sepete ilk dokunuşta kullanıcıya taşınıyor ve çerez siliniyor; misafirken
   * eklenen ürünler kaybolmuyor.
   */
  router.use(async (req, res, next) => {
    const misafir = req.cookies[COOKIES.CART];
    if (!req.auth?.userId || !misafir) return next();
    try {
      await commands.execute(new AdoptGuestCartCommand({ userId: req.auth.userId, guestCartId: misafir }), req.context());
      appendCookie(res, clearCookie(COOKIES.CART, { secure: config.cookieSecure, sameSite: "Lax" }));
      next();
    } catch (hata) {
      next(hata);
    }
  });

  /** Giriş yapılmışsa kullanıcı, değilse çerezdeki misafir sepeti. */
  const identity = (req: Request) => ({ userId: req.auth?.userId ?? null, guestCartId: req.guestCartId });

  /** Sepeti döndürür; değişiklikten sonra ortak yanıt biçimi. */
  const respondWithCart = async (req: Request, res: Response, status = 200) => {
    const cart = await queries.ask(new GetCartQuery(identity(req)));
    res.status(status).json(cart);
  };

  router.get("/", async (req, res) => {
    await respondWithCart(req, res);
  });

  router.post("/items", async (req, res) => {
    const result = await commands.execute<CartMutationResult>(
      new AddToCartCommand({ ...identity(req), productId: req.body?.productId, quantity: req.body?.quantity ?? 1 }),
      req.context()
    );
    // Yeni açılan misafir sepetinin kimliği çereze yazılır.
    res.rememberGuestCart(result.cartId);
    if (result.isGuestCart) req.guestCartId = result.cartId;
    await respondWithCart(req, res, 201);
  });

  router.put("/items/:productId", async (req, res) => {
    await commands.execute(
      new UpdateCartItemCommand({ ...identity(req), productId: yol(req, "productId"), quantity: req.body?.quantity }),
      req.context()
    );
    await respondWithCart(req, res);
  });

  router.delete("/items/:productId", async (req, res) => {
    await commands.execute(
      new RemoveFromCartCommand({ ...identity(req), productId: yol(req, "productId") }),
      req.context()
    );
    await respondWithCart(req, res);
  });

  router.delete("/", async (req, res) => {
    await commands.execute(new ClearCartCommand(identity(req)), req.context());
    await respondWithCart(req, res);
  });

  return router;
}

