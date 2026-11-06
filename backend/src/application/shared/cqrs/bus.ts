"use strict";

import { Command, Query, type Handler } from "./Message";

/** Bus'a kaydedilebilen mesaj sınıfı. */
export type MessageClass<T = unknown> = abstract new (...args: never[]) => T;

/** Kesişen işler (günlükleme, ölçüm) için zincir halkası. */
export type Middleware<TContext = unknown> = (
  message: object,
  context: TContext,
  next: (message: object, context: TContext) => Promise<unknown>
) => Promise<unknown>;

/**
 * Bağımlılıksız CQRS veri yolları.
 *
 * Her mesaj sınıfı tek bir handler'a kaydedilir; kayıt mesaj sınıfının kendisiyle
 * yapıldığı için yanlış veri yoluna gönderilen mesaj anında yakalanır.
 *
 * Middleware desteği açık/kapalı prensibi içindir: günlükleme, ölçüm ve
 * yeniden deneme gibi kesişen işler handler'lara dokunmadan eklenir.
 */
export class MessageBus<TContext = unknown> {
  readonly kind: string;
  private readonly BaseClass: Function;
  private readonly handlers = new Map<Function, Handler<never, unknown, TContext>>();
  private readonly middlewares: Middleware<TContext>[] = [];

  constructor(kind: string, BaseClass: Function) {
    this.kind = kind;
    this.BaseClass = BaseClass;
  }

  use(middleware: Middleware<TContext>): this {
    if (typeof middleware !== "function") throw new TypeError("Middleware bir fonksiyon olmalı.");
    this.middlewares.push(middleware);
    return this;
  }

  register(MessageClass: Function, handler: Handler<never, unknown, TContext>): this {
    if (typeof MessageClass !== "function") {
      throw new TypeError(`${this.kind} sınıfı bekleniyordu.`);
    }
    if (!(MessageClass.prototype instanceof this.BaseClass)) {
      throw new TypeError(`${MessageClass.name} bir ${this.BaseClass.name} olmalı.`);
    }
    if (!handler || typeof handler.handle !== "function") {
      throw new TypeError(`${MessageClass.name} için handle() metodu olan bir handler gerekli.`);
    }
    if (this.handlers.has(MessageClass)) {
      throw new Error(`${MessageClass.name} için zaten bir handler kayıtlı.`);
    }
    this.handlers.set(MessageClass, handler);
    return this;
  }

  get registeredCount(): number {
    return this.handlers.size;
  }

  async dispatch(message: object, context: TContext = {} as TContext): Promise<unknown> {
    const handler = message ? this.handlers.get(message.constructor) : undefined;
    if (!handler) {
      const name = (message as { constructor?: { name?: string } })?.constructor?.name ?? typeof message;
      throw new Error(`${name} için kayıtlı ${this.kind} handler'ı yok.`);
    }

    // Middleware zinciri: son halka gerçek handler'dır.
    const run = this.middlewares.reduceRight<(msg: object, ctx: TContext) => Promise<unknown>>(
      (next, middleware) => (msg, ctx) => middleware(msg, ctx, next),
      async (msg, ctx) => (handler.handle as (m: object, c: TContext) => unknown)(msg, ctx)
    );
    return run(message, context);
  }
}

export class CommandBus<TContext = unknown> extends MessageBus<TContext> {
  constructor() {
    super("command", Command);
  }

  /**
   * TResult'ı çağıran beyan eder (varsayılan: unknown).
   *
   * Bus kayıt tablosuna dayandığı için mesajdan sonucu kendisi çıkaramaz;
   * tipi burada açıkça yazmak, dönen değeri hiç tiplememekten iyidir —
   * hiç olmazsa beklenti kodda görünür ve yanlış alan okunursa derleme durur.
   */
  execute<TResult = unknown>(command: object, context?: TContext): Promise<TResult> {
    return this.dispatch(command, context) as Promise<TResult>;
  }
}

export class QueryBus<TContext = unknown> extends MessageBus<TContext> {
  constructor() {
    super("query", Query);
  }

  /** Bkz. CommandBus.execute: sonucun tipini çağıran beyan eder. */
  ask<TResult = unknown>(query: object, context?: TContext): Promise<TResult> {
    return this.dispatch(query, context) as Promise<TResult>;
  }
}
