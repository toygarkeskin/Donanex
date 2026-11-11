"use strict";

import { defineContext } from "../shared/registry";

import * as RecordNotifications from "./commands/RecordNotifications";
import * as MarkNotificationRead from "./commands/MarkNotificationRead";
import * as MarkAllNotificationsRead from "./commands/MarkAllNotificationsRead";
import * as ListNotifications from "./queries/ListNotifications";
import * as CountUnreadNotifications from "./queries/CountUnreadNotifications";

/*
 * Tip yeniden dışa AÇILMIYOR: "export =" kullanan bir modüle başka bir dışa
 * açma eklenemez (TS2309). Rotalar akış adını ("mine", "store", "admin") düz
 * metin olarak geçiyor, tipe ihtiyaç duymuyor; taslak tipini ise bildirim
 * tüketicisi doğrudan kendi modülünden alıyor.
 */
export = defineContext({
  name: "notifications",
  commands: {
    RecordNotifications,
    MarkNotificationRead,
    MarkAllNotificationsRead
  },
  queries: {
    ListNotifications,
    CountUnreadNotifications
  }
});
