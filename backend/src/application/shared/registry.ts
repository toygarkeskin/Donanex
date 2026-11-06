"use strict";

import type { Handler } from "./cqrs/Message";

/** Bir kullanım senaryosu dosyasının dışa açtıkları: <Ad>Command/Query + <Ad>Handler. */
export type UseCaseModule = Record<string, unknown>;

/** Handler sınıfı: container bunu servislerle kurar. */
export type HandlerClass = new (services: never) => Handler<never, unknown, never>;

export interface ContextDefinition {
  name: string;
  commands?: Record<string, UseCaseModule>;
  queries?: Record<string, UseCaseModule>;
}

export interface BoundedContext {
  readonly name: string;
  readonly commandHandlers: ReadonlyArray<readonly [Function, HandlerClass]>;
  readonly queryHandlers: ReadonlyArray<readonly [Function, HandlerClass]>;
  readonly [exportedMessage: string]: unknown;
}

/**
 * Bağlam (bounded context) modüllerini tek biçimde tanımlar.
 * Her bağlam kendi kullanım senaryolarını dışa açar; composition root
 * bunları tek döngüyle bus'lara kaydeder ve yeni bağlam eklemek için
 * container.js'i değiştirmek gerekmez (açık/kapalı prensibi).
 */
export function defineContext({ name, commands = {}, queries = {} }: ContextDefinition): BoundedContext {
  const messages: Record<string, unknown> = {};
  const commandHandlers: Array<readonly [Function, HandlerClass]> = [];
  const queryHandlers: Array<readonly [Function, HandlerClass]> = [];

  for (const [key, useCase] of Object.entries(commands)) {
    const Message = useCase[`${key}Command`] as Function | undefined;
    const HandlerImpl = useCase[`${key}Handler`] as HandlerClass | undefined;
    if (!Message || !HandlerImpl) throw new Error(`${name}/${key}: Command veya Handler dışa açılmamış.`);
    messages[`${key}Command`] = Message;
    commandHandlers.push([Message, HandlerImpl]);
  }

  for (const [key, useCase] of Object.entries(queries)) {
    const Message = useCase[`${key}Query`] as Function | undefined;
    const HandlerImpl = useCase[`${key}Handler`] as HandlerClass | undefined;
    if (!Message || !HandlerImpl) throw new Error(`${name}/${key}: Query veya Handler dışa açılmamış.`);
    messages[`${key}Query`] = Message;
    queryHandlers.push([Message, HandlerImpl]);
  }

  return Object.freeze({ name, ...messages, commandHandlers, queryHandlers }) as BoundedContext;
}
