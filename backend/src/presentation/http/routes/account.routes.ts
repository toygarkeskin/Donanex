"use strict";

import type { RouteContext } from "../types";
import type { BildirimDagitici } from "../support/bildirimAkisi";
import type { ChangePasswordResult, Sonuc } from "../support/results";

import { kullanici, yol } from "../support/params";
import { Router } from "express";
import {
  GetCurrentUserQuery,
  UpdateProfileCommand,
  ChangePasswordCommand,
  SaveAddressCommand,
  DeleteAddressCommand,
  ListAddressesQuery
} from "../../../application/identity";
import {
  ListMyOrdersQuery,
  GetMyOrderQuery,
  CancelOrderCommand
} from "../../../application/ordering";
import { ApplyForStoreCommand } from "../../../application/stores";
import {
  ListTicketsQuery,
  GetTicketQuery,
  AddTicketAttachmentCommand,
  GetTicketAttachmentQuery
} from "../../../application/support";
import { ekGovdesi, ekGovdesiYoksa, dosyaAdi, ekiGonder } from "../support/ekler";
import {
  ListNotificationsQuery,
  CountUnreadNotificationsQuery,
  MarkNotificationReadCommand,
  MarkAllNotificationsReadCommand
} from "../../../application/notifications";
import { requireAuth } from "../middleware/authenticate";
import { COOKIES, buildCookie, appendCookie } from "../support/cookies";

/** Kullanıcının kendi hesabı. Tüm uçlar yalnızca kendi verisine erişir. */
export function accountRoutes({
  commands,
  queries,
  config,
  limiters,
  bildirimler
}: Pick<RouteContext, "commands" | "queries" | "config" | "limiters"> & {
  bildirimler?: BildirimDagitici | null;
}): Router {
  const router = Router();
  router.use(requireAuth);

  router.get("/", async (req, res) => {
    res.json(await queries.ask(new GetCurrentUserQuery({ userId: kullanici(req) }), req.context()));
  });

  router.put("/profile", async (req, res) => {
    const profile = await commands.execute<Sonuc>(
      new UpdateProfileCommand({ userId: kullanici(req), data: req.body }),
      req.context()
    );
    res.json({ ...profile, message: "Bilgileriniz güncellendi." });
  });

  router.put("/password", limiters.passwordChange, async (req, res) => {
    const { session } = await commands.execute<ChangePasswordResult>(
      new ChangePasswordCommand({
        userId: kullanici(req),
        currentPassword: req.body?.currentPassword,
        newPassword: req.body?.newPassword
      }),
      req.context()
    );
    // Bu cihaz oturumda kalır, diğerleri düşer.
    appendCookie(
      res,
      buildCookie(COOKIES.SSO, session.token, {
        maxAgeSeconds: session.maxAgeSeconds,
        secure: config.cookieSecure,
        sameSite: "Lax"
      })
    );
    res.json({
      message: "Parolanız değiştirildi. Diğer cihazlardaki oturumlarınız kapatıldı.",
      reauthenticate: true
    });
  });

  /* ----- adresler ----- */

  router.get("/addresses", async (req, res) => {
    res.json({ items: await queries.ask(new ListAddressesQuery({ userId: kullanici(req) })) });
  });

  router.post("/addresses", async (req, res) => {
    const address = await commands.execute(
      new SaveAddressCommand({ userId: kullanici(req), data: req.body }),
      req.context()
    );
    res.status(201).json(address);
  });

  router.put("/addresses/:addressId", async (req, res) => {
    const address = await commands.execute(
      new SaveAddressCommand({ userId: kullanici(req), addressId: yol(req, "addressId"), data: req.body }),
      req.context()
    );
    res.json(address);
  });

  router.delete("/addresses/:addressId", async (req, res) => {
    await commands.execute(
      new DeleteAddressCommand({ userId: kullanici(req), addressId: yol(req, "addressId") }),
      req.context()
    );
    res.status(204).end();
  });

  /* ----- siparişler ----- */

  router.get("/orders", async (req, res) => {
    res.json(await queries.ask(new ListMyOrdersQuery({ userId: kullanici(req), filters: req.query })));
  });

  router.get("/orders/:orderId", async (req, res) => {
    res.json(await queries.ask(new GetMyOrderQuery({ userId: kullanici(req), orderId: yol(req, "orderId") })));
  });

  router.post("/orders/:orderId/cancel", async (req, res) => {
    const result = await commands.execute<Sonuc>(
      new CancelOrderCommand({ userId: kullanici(req), orderId: yol(req, "orderId") }),
      req.context()
    );
    res.json({ ...result, message: "Siparişiniz iptal edildi." });
  });

  /* ----- destek ----- */

  router.get("/tickets", async (req, res) => {
    res.json(
      await queries.ask(
        new ListTicketsQuery({ scope: "mine", userId: kullanici(req), filters: req.query }),
        req.context()
      )
    );
  });

  router.get("/tickets/:ticketId", async (req, res) => {
    res.json(
      await queries.ask(
        new GetTicketQuery({ scope: "mine", userId: kullanici(req), ticketId: yol(req, "ticketId") }),
        req.context()
      )
    );
  });

  /* ----- talep ekleri -----
     Yalnızca talebin SAHİBİ ekleyip indirebilir; sahiplik handler'da ve
     read model sorgusunda ayrıca soruluyor. */

  router.post("/tickets/:ticketId/ekler", limiters.support, ekGovdesi, async (req, res) => {
    if (ekGovdesiYoksa(req, res)) return;
    const ek = await commands.execute(
      new AddTicketAttachmentCommand({
        scope: "mine",
        userId: kullanici(req),
        ticketId: yol(req, "ticketId"),
        originalName: dosyaAdi(req),
        content: req.body
      }),
      req.context()
    );
    res.status(201).json(ek);
  });

  router.get("/tickets/:ticketId/ekler/:ekId", async (req, res) => {
    ekiGonder(
      res,
      await queries.ask(
        new GetTicketAttachmentQuery({
          scope: "mine",
          userId: kullanici(req),
          ticketId: yol(req, "ticketId"),
          attachmentId: yol(req, "ekId")
        }),
        req.context()
      )
    );
  });

  /* ----- bildirimler ----- */

  router.get("/notifications", async (req, res) => {
    res.json(
      await queries.ask(new ListNotificationsQuery({ feed: "mine", userId: kullanici(req), filters: req.query }))
    );
  });

  router.get("/notifications/unread-count", async (req, res) => {
    res.json(await queries.ask(new CountUnreadNotificationsQuery({ feed: "mine", userId: kullanici(req) })));
  });

  /**
   * Gerçek zamanlı bildirim akışı (Server-Sent Events).
   *
   * TEK bağlantı, kişinin görebildiği bütün kutuları taşır: kendi
   * bildirimleri, yetkili olduğu mağazaların ve —sistem yöneticisiyse—
   * yönetimin. Kutu başına ayrı bağlantı açmak aynı veriyi birden çok kez
   * taşımak ve her panel geçişinde bağlantıyı yeniden kurmak olurdu.
   *
   * İzin listesi JETONDAN değil, her istekte sunucuda çözülen yetkiden
   * (req.auth.policy) çıkar: bir kişinin mağaza yetkisi alındıktan sonra
   * bağlantısını yenilediğinde o mağazanın bildirimleri artık gelmez.
   *
   * Kanal kurulamazsa 503: istemci bunu görüp yoklamaya düşüyor.
   */
  router.get("/notifications/stream", async (req, res) => {
    const userId = kullanici(req);
    if (!bildirimler?.available) {
      res.status(503).json({ error: "stream_unavailable", message: "Gerçek zamanlı bildirim şu an kapalı." });
      return;
    }

    const policy = req.auth?.policy;
    const keys = new Set<string>([`user:${userId}`]);
    for (const storeId of policy?.storeIds ?? []) keys.add(`store:${storeId}`);
    if (policy?.isSystemAdmin()) keys.add("admin:");

    try {
      await bildirimler.aboneOl();
    } catch {
      res.status(503).json({ error: "stream_unavailable", message: "Gerçek zamanlı bildirim şu an kapalı." });
      return;
    }
    bildirimler.bagla(res, keys);
  });

  router.post("/notifications/:notificationId/read", async (req, res) => {
    res.json(
      await commands.execute(
        new MarkNotificationReadCommand({
          feed: "mine",
          userId: kullanici(req),
          notificationId: yol(req, "notificationId")
        }),
        req.context()
      )
    );
  });

  router.post("/notifications/read-all", async (req, res) => {
    res.json(
      await commands.execute(
        new MarkAllNotificationsReadCommand({ feed: "mine", userId: kullanici(req) }),
        req.context()
      )
    );
  });

  /* ----- mağaza başvurusu ----- */

  router.post("/store-application", limiters.storeApplication, async (req, res) => {
    const store = await commands.execute(
      new ApplyForStoreCommand({ userId: kullanici(req), data: req.body }),
      req.context()
    );
    res.status(201).json({
      store,
      message: "Başvurunuz alındı. Yönetici onayından sonra satışa başlayabilirsiniz."
    });
  });

  return router;
}

