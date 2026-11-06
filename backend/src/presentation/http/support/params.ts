"use strict";

import type { Request } from "express";
import { UnauthorizedError, ValidationError } from "../../../domain/shared/errors";

/**
 * Giriş yapmış kullanıcının kimliği.
 *
 * Bu yardımcının kullanıldığı rotaların önünde `requireAuth` durur, dolayısıyla
 * `req.auth` orada her zaman doludur. Ama bu güvence MIDDLEWARE SIRASINDAN
 * gelir ve derleyici onu göremez — eski JavaScript sürümünde `req.auth.userId`
 * doğrudan okunuyordu, yani güvence yalnızca sözdeydi.
 *
 * Burada güvence hem tipe (dönüş `string`) hem çalışma zamanına yazılıyor:
 * sıralama ileride bozulursa istek net bir 401 alır, `undefined` aşağıdaki
 * katmanlara sızıp "kimin verisi" sorusunu bulanıklaştırmaz.
 */
export function kullanici(req: Request): string {
  const userId = req.auth?.userId;
  if (!userId) throw new UnauthorizedError("Bu işlem için giriş yapmalısınız.");
  return userId;
}

/**
 * Yol parametresini tek bir metin olarak okur.
 *
 * Express 5'in tipi `string | string[]` der, çünkü joker (`*`) rotalarda bir
 * parametre dizi olabilir. Bu uygulamada joker rota yoktur — her parametre
 * `:ad` biçiminde tek değer alır — ama tipi körü körüne zorlamak yerine
 * gerçekten tek olduğuna BAKIYORUZ. Böylece ileride joker bir rota eklenirse
 * sessizce yanlış veri akmaz, istek anlaşılır bir hatayla durur.
 */
export function yol(req: Request, ad: string): string {
  const deger = req.params[ad];
  if (typeof deger === "string") return deger;
  throw new ValidationError(`Geçersiz yol parametresi: ${ad}`);
}

/**
 * Sorgu dizesinden tek bir metin okur.
 *
 * `?durum=a&durum=b` gönderildiğinde Express bir DİZİ üretir. Aşağıdaki
 * katmanlar metin beklediği için dizi, filtrenin sessizce hiçbir şeyle
 * eşleşmemesine yol açar — istek başarılı görünür, sonuç yanlış olur.
 * Bu yüzden dizi gelirse İLK değer alınır ve aşağıya hep tek metin iner.
 */
export function sorgu(req: Request, ad: string): string | undefined {
  const deger = req.query[ad];
  if (deger === undefined) return undefined;
  if (typeof deger === "string") return deger;
  if (Array.isArray(deger) && typeof deger[0] === "string") return deger[0];
  return undefined;
}
