"use strict";

import type { RouteContext } from "../types";
import type { CompleteAuthorizationResult, SignInResult, SignInStepResult, VerifySignInCodeResult } from "../support/results";

import { Router, type Request, type Response } from "express";
import {
  RegisterUserCommand,
  SignInCommand,
  VerifySignInCodeCommand,
  ResendSignInCodeCommand,
  SignOutCommand,
  CompleteAuthorizationCommand,
  RequestPasswordResetCommand,
  ResetPasswordCommand,
  VerifyEmailCommand,
  GetAuthorizationRequestQuery
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
export function authRoutes({
  commands,
  queries,
  config,
  limiters
}: Pick<RouteContext, "commands" | "queries" | "config" | "limiters">): Router {
  const router = Router();

  /*
   * Bekleyen yetkilendirme isteği hâlâ geçerli mi? İŞLEMDEN ÖNCE bakılıyor.
   * Önceden süre ancak oturum açıldıktan sonra fark ediliyordu: hesap
   * oluşmuş, kod harcanmış, oturum çerezi yazılmış ama kullanıcı hata
   * görüyordu; kayıtta tekrar denemek "bu e-posta kayıtlı" diyordu. Süresi
   * dolmuşsa hiçbir şey yapılmadan reddediliyor (ayrıntıda neden yazıyor),
   * istemci yeni istek açıp aynı işlemi tekrarlıyor.
   */
  const istegiDenetle = async (req: Request) => {
    const authRequestId = req.body?.authRequestId;
    if (authRequestId) await queries.ask(new GetAuthorizationRequestQuery({ authRequestId }));
  };

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
    await istegiDenetle(req);
    const result = await commands.execute<SignInResult>(
      new RegisterUserCommand({ data: req.body, guestCartId: req.guestCartId }),
      req.context()
    );
    await completeSignIn(req, res, result, 201);
  });

  /*
   * Giriş iki adımlı: parola doğruysa çoğu zaman oturum AÇILMAZ, e-postaya
   * kod gider ve yanıt { verificationRequired, challengeId } olur. Tarayıcı
   * "bu cihazı hatırla" çerezini taşıyorsa (ve çerez bu kullanıcınınsa)
   * kod adımı atlanır, yanıt eskisi gibi oturumla döner.
   */
  router.post("/sign-in", limiters.signIn, async (req, res) => {
    await istegiDenetle(req);
    const result = await commands.execute<SignInStepResult>(
      new SignInCommand({
        email: req.body?.email,
        password: req.body?.password,
        guestCartId: req.guestCartId,
        trustedDeviceToken: req.cookies[COOKIES.DEVICE] || null
      }),
      req.context()
    );
    if ("verificationRequired" in result && result.verificationRequired) {
      res.json({
        verificationRequired: true,
        challengeId: result.challengeId,
        maskedEmail: result.maskedEmail
      });
      return;
    }
    await completeSignIn(req, res, result as SignInResult);
  });

  router.post("/sign-in/verify", limiters.signIn, async (req, res) => {
    await istegiDenetle(req);
    const result = await commands.execute<VerifySignInCodeResult>(
      new VerifySignInCodeCommand({
        challengeId: req.body?.challengeId,
        code: req.body?.code,
        rememberDevice: req.body?.rememberDevice,
        guestCartId: req.guestCartId
      }),
      req.context()
    );
    if (result.trustedDevice) {
      // Yalnızca giriş uçlarına gider (Path): başka hiçbir isteğe eklenmez.
      appendCookie(
        res,
        buildCookie(COOKIES.DEVICE, result.trustedDevice.token, {
          maxAgeSeconds: result.trustedDevice.maxAgeSeconds,
          secure: config.cookieSecure,
          sameSite: "Strict",
          path: "/api/auth"
        })
      );
    }
    await completeSignIn(req, res, result);
  });

  router.post("/sign-in/resend", limiters.signIn, async (req, res) => {
    res.json(await commands.execute(new ResendSignInCodeCommand({ challengeId: req.body?.challengeId }), req.context()));
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

