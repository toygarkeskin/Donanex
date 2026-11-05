"use strict";

/**
 * Bağımlılıksız CQRS veri yolları.
 *
 *  - Command: sistemin durumunu DEĞİŞTİRİR, (gerekirse) küçük bir sonuç döner.
 *  - Query:   yalnızca OKUR, hiçbir şeyi değiştirmez.
 *
 * Her mesaj sınıfı tek bir handler'a kaydedilir. Kayıt mesaj sınıfının kendisiyle
 * yapıldığından, yanlış veri yoluna gönderilen mesaj hemen yakalanır.
 */
class MessageBus {
  constructor(kind) {
    this.kind = kind;
    this.handlers = new Map();
  }

  register(MessageClass, handler) {
    if (typeof MessageClass !== "function") {
      throw new TypeError(`${this.kind} sınıfı bekleniyordu.`);
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

  async dispatch(message) {
    const handler = message && this.handlers.get(message.constructor);
    if (!handler) {
      const name = message?.constructor?.name || typeof message;
      throw new Error(`${name} için kayıtlı ${this.kind} handler'ı yok.`);
    }
    return handler.handle(message);
  }
}

class CommandBus extends MessageBus {
  constructor() {
    super("command");
  }

  execute(command) {
    return this.dispatch(command);
  }
}

class QueryBus extends MessageBus {
  constructor() {
    super("query");
  }

  ask(query) {
    return this.dispatch(query);
  }
}

module.exports = { CommandBus, QueryBus };
