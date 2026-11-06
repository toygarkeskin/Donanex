"use strict";

import type { RouteContext } from "../types";
import type { CompleteAuthorizationResult, SignInResult } from "../support/results";

import { Router, type Request, type Response } from "express";
import {
  RegisterUserCommand,
  SignInCommand,
  SignOutCommand,
  CompleteAuthorizationCommand,
  RequestPasswordResetCommand,
  ResetPasswordCommand,
  VerifyEmailCommand
} from "../../../application/identity";
import { COOKIES, buildCookie, clearCookie, appendCookie } from "../support/cookies";

/**
 * Arayüzün kimlik uçları.
 *
 * Giriş formu OAuth sunucusunda değil, Vue uygulamasındadır: kullanıcı
 * tanıdık bir ekranda kalır, akış yine de standart yetkilendirme kodu
 * akışıdır. Giriş başarılı olunca bekleyen /oauth/authorize isteği
 * tamamlanır ve istemciye dönülecek adres verilir.
 */
export function authRoutes({ commands, config, limiters }: Pick<RouteContext, "commands" | "config" | "limiters">): Router {
  const router = Router();

  const setSsoCookie = (res: Response, session: { token: string; maxAgeSeconds: number }) =>
    appendCookie(
      res,
      buildCookie(COOKIES.SSO, session.token, {
        maxAgeSeconds: session.maxAgeSeconds,
        secure: config.cookieSecure,
        sameSite: "Lax"
      })
    );

  /** Giriş ya da kayıt sonrası ortak adım: oturumu kur, akışı tamamla. */
  async function completeSignIn(req: Request, res: Response, result: SignInResult, status = 200) {
    setSsoCookie(res, result.session);
    // Misafir sepeti kullanıcıya taşındı; artık misafir çerezi gereksiz.
    appendCookie(res, clearCookie(COOKIES.CART, { secure: config.cookieSecure, sameSite: "Lax" }));

    let redirectTo = null;
    if (req.body?.authRequestId) {
      const completion = await commands.execute<CompleteAuthorizationResult>(
        new CompleteAuthorizationCommand({
          authRequestId: req.body.authRequestId,
          userId: result.user.id,
          sessionId: result.session.sessionId
        })
      );
      redirectTo = completion.redirectTo;
    }

    res.status(status).json({
      user: result.user,
      mergedCartItems: result.mergedCartItems,
      redirectTo
    });
  }

  router.post("/register", limiters.register, async (req, res) => {
    const result = await commands.execute<SignInResult>(
      new RegisterUserCommand({ data: req.body, guestCartId: req.guestCartId }),
      req.context()
    );
    await completeSignIn(req, res, result, 201);
  });

  router.post("/sign-in", limiters.signIn, async (req, res) => {
    const result = await commands.execute<SignInResult>(
      new SignInCommand({
        email: req.body?.email,
        password: req.body?.password,
        guestCartId: req.guestCartId
      }),
      req.context()
    );
    await completeSignIn(req, res, result);
  });

  router.post("/sign-out", async (req, res) => {
    await commands.execute(
      new SignOutCommand({
        ssoToken: req.cookies[COOKIES.SSO],
        everywhere: req.body?.everywhere === true
      }),
      req.context()
    );
    appendCookie(res, clearCookie(COOKIES.SSO, { secure: config.cookieSecure, sameSite: "Lax" }));
    appendCookie(res, clearCookie(COOKIES.REFRESH, { secure: config.cookieSecure, sameSite: "Strict" }));
    res.json({ signedOut: true });
  });

  router.post("/password/forgot", limiters.passwordReset, async (req, res) => {
    // Yanıt her zaman aynıdır: e-postanın kayıtlı olup olmadığı anlaşılmaz.
    await commands.execute(new RequestPasswordResetCommand({ email: req.body?.email }));
    res.json({
      message: "Bu e-posta kayıtlıysa sıfırlama bağlantısı gönderildi. Gelen kutunuzu kontrol edin."
    });
  });

  router.post("/password/reset", limiters.passwordReset, async (req, res) => {
    await commands.execute(
      new ResetPasswordCommand({ token: req.body?.token, newPassword: req.body?.password }),
      req.context()
    );
    res.json({ message: "Parolanız güncellendi. Şimdi giriş yapabilirsiniz." });
  });

  router.post("/email/verify", async (req, res) => {
    await commands.execute(new VerifyEmailCommand({ token: req.body?.token }));
    res.json({ message: "E-posta adresiniz doğrulandı." });
  });

  return router;
}

