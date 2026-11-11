"use strict";

import { ValidationError } from "../../domain/shared/errors";
import { assertCan, type UseCaseContext } from "../shared/authorize";
import type { NotificationTarget } from "../shared/contracts";

/**
 * Bildirim akışları.
 *
 *   mine  → kişinin kendi bildirimleri
 *   store → bir mağazanın bildirimleri (panelde)
 *   admin → yönetim panelinin bildirimleri
 */
export type NotificationFeed = "mine" | "store" | "admin";

export const NOTIFICATION_FEEDS: readonly NotificationFeed[] = Object.freeze(["mine", "store", "admin"]);

/**
 * Akış adını alıcıya çevirir ve YETKİYİ BURADA sorar.
 *
 * Tek yerde durmasının sebebi şu: dört kullanım senaryosu (listele, sayaç,
 * okundu işaretle, tümünü işaretle) aynı kapsam sorusunu soruyor. Her birinde
 * ayrı ayrı yazılsaydı, birinde "mağaza numarası geldi mi" denetimini atlamak
 * o uçtan başka mağazanın bildirimlerini okumaya yeterdi.
 *
 * "mine" akışında yetki sorulmaz: kapsam kullanıcının KENDİ numarası ve o
 * numara jetondan geliyor, istekten değil. Diğer ikisinde izin denetimi
 * mağaza kapsamıyla yapılır.
 */
export function bildirimAlicisi(
  feed: NotificationFeed,
  { userId, storeId }: { userId?: string | null; storeId?: string | null },
  context: UseCaseContext = {}
): NotificationTarget {
  if (feed === "store") {
    if (!storeId) throw new ValidationError("Mağaza numarası gerekli.");
    assertCan(context, "notification:read", { storeId });
    return { scope: "store", scopeId: storeId };
  }

  if (feed === "admin") {
    assertCan(context, "notification:read");
    return { scope: "admin", scopeId: null };
  }

  if (!userId) throw new ValidationError("Kullanıcı numarası gerekli.");
  return { scope: "user", scopeId: userId };
}
