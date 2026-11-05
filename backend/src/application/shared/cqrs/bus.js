"use strict";

const { Command, Query } = require("./Message");

/**
 * Bağımlılıksız CQRS veri yolları.
 *
 * Her mesaj sınıfı tek bir handler'a kaydedilir; kayıt mesaj sınıfının kendisiyle
 * yapıldığı için yanlış veri yoluna gönderilen mesaj anında yakalanır.
 *
 * Middleware desteği açık/kapalı prensibi içindir: günlükleme, ölçüm ve
 * yeniden deneme gibi kesişen işler handler'lara dokunmadan eklenir.
 */
class MessageBus {
  constructor(kind, BaseClass) {
    this.kind = kind;
    this.BaseClass = BaseClass;
    this.handlers = new Map();
    this.middlewares = [];
  }

  use(middleware) {
    if (typeof middleware !== "function") throw new TypeError("Middleware bir fonksiyon olmalı.");
    this.middlewares.push(middleware);
    return this;
  }

  register(MessageClass, handler) {
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

  get registeredCount() {
    return this.handlers.size;
  }

  async dispatch(message, context = {}) {
    const handler = message && this.handlers.get(message.constructor);
    if (!handler) {
      const name = message?.constructor?.name || typeof message;
      throw new Error(`${name} için kayıtlı ${this.kind} handler'ı yok.`);
    }

    // Middleware zinciri: son halka gerçek handler'dır.
    const run = this.middlewares.reduceRight(
      (next, middleware) => (msg, ctx) => middleware(msg, ctx, next),
      (msg, ctx) => handler.handle(msg, ctx)
    );
    return run(message, context);
  }
}

class CommandBus extends MessageBus {
  constructor() {
    super("command", Command);
  }

  execute(command, context) {
    return this.dispatch(command, context);
  }
}

class QueryBus extends MessageBus {
  constructor() {
    super("query", Query);
  }

  ask(query, context) {
    return this.dispatch(query, context);
  }
}

module.exports = { CommandBus, QueryBus };
