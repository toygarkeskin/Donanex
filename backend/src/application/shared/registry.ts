"use strict";

import type { Handler } from "./cqrs/Message";

/** Bir kullanım senaryosu dosyasının dışa açtıkları: <Ad>Command/Query + <Ad>Handler. */
export type UseCaseModule = Record<string, unknown>;

/** Handler sınıfı: container bunu servislerle kurar. */
export type HandlerClass = new (services: never) => Handler<never, unknown, never>;

/**
 * Kullanım senaryosu adlarından mesaj sınıfı adlarını türetir.
 *
 * { SignIn: <modül> } verildiğinde { SignInCommand: <o modüldeki sınıf> } üretir.
 * Böylece bağlamın dışa açtığı mesajlar derlemede ADIYLA bilinir: presentation
 * yanlış ya da kaldırılmış bir mesajı içe aktarırsa derleme durur, hata o rota
 * çalışana kadar beklemez.
 */
type Messages<T, Suffix extends string> = {
  readonly [K in Extract<keyof T, string> as `${K}${Suffix}`]: `${K}${Suffix}` extends keyof T[K]
    ? T[K][`${K}${Suffix}`]
    : never;
};

export interface ContextDefinition<C, Q> {
  name: string;
  commands?: C;
  queries?: Q;
}

/** Bağlamın public yüzü: kayıt listeleri + adıyla açılan mesaj sınıfları. */
export type BoundedContext<C = {}, Q = {}> = {
  readonly name: string;
  readonly commandHandlers: ReadonlyArray<readonly [Function, HandlerClass]>;
  readonly queryHandlers: ReadonlyArray<readonly [Function, HandlerClass]>;
} & Messages<C, "Command"> &
  Messages<Q, "Query">;

/**
 * Bağlam (bounded context) modüllerini tek biçimde tanımlar.
 * Her bağlam kendi kullanım senaryolarını dışa açar; composition root
 * bunları tek döngüyle bus'lara kaydeder ve yeni bağlam eklemek için
 * container'ı değiştirmek gerekmez (açık/kapalı prensibi).
 */
export function defineContext<
  C extends Record<string, UseCaseModule> = {},
  Q extends Record<string, UseCaseModule> = {}
>({ name, commands, queries }: ContextDefinition<C, Q>): BoundedContext<C, Q> {
  const messages: Record<string, unknown> = {};
  const commandHandlers: Array<readonly [Function, HandlerClass]> = [];
  const queryHandlers: Array<readonly [Function, HandlerClass]> = [];

  for (const [key, useCase] of Object.entries(commands ?? {})) {
    const Message = useCase[`${key}Command`] as Function | undefined;
    const HandlerImpl = useCase[`${key}Handler`] as HandlerClass | undefined;
    if (!Message || !HandlerImpl) throw new Error(`${name}/${key}: Command veya Handler dışa açılmamış.`);
    messages[`${key}Command`] = Message;
    commandHandlers.push([Message, HandlerImpl]);
  }

  for (const [key, useCase] of Object.entries(queries ?? {})) {
    const Message = useCase[`${key}Query`] as Function | undefined;
    const HandlerImpl = useCase[`${key}Handler`] as HandlerClass | undefined;
    if (!Message || !HandlerImpl) throw new Error(`${name}/${key}: Query veya Handler dışa açılmamış.`);
    messages[`${key}Query`] = Message;
    queryHandlers.push([Message, HandlerImpl]);
  }

  // Mesaj sınıfları yukarıdaki döngülerde ÇALIŞMA ZAMANINDA yerleştirildi;
  // derleyici bu bağı takip edemez, bu yüzden tip burada bir kez beyan ediliyor.
  // Beyanın doğruluğunu döngüler koruyor: bir modül <Ad>Command'ı dışa
  // açmazsa kurulumda hata fırlatılır, yanlış tiple devam edilmez.
  return Object.freeze({ name, ...messages, commandHandlers, queryHandlers }) as unknown as BoundedContext<C, Q>;
}
