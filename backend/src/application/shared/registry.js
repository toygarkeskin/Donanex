"use strict";

/**
 * Bağlam (bounded context) modüllerini tek biçimde tanımlar.
 * Her bağlam kendi kullanım senaryolarını dışa açar; composition root
 * bunları tek döngüyle bus'lara kaydeder ve yeni bağlam eklemek için
 * container.js'i değiştirmek gerekmez (açık/kapalı prensibi).
 */
function defineContext({ name, commands = {}, queries = {} }) {
  const messages = {};
  const commandHandlers = [];
  const queryHandlers = [];

  for (const [key, useCase] of Object.entries(commands)) {
    const Message = useCase[`${key}Command`];
    const Handler = useCase[`${key}Handler`];
    if (!Message || !Handler) throw new Error(`${name}/${key}: Command veya Handler dışa açılmamış.`);
    messages[`${key}Command`] = Message;
    commandHandlers.push([Message, Handler]);
  }

  for (const [key, useCase] of Object.entries(queries)) {
    const Message = useCase[`${key}Query`];
    const Handler = useCase[`${key}Handler`];
    if (!Message || !Handler) throw new Error(`${name}/${key}: Query veya Handler dışa açılmamış.`);
    messages[`${key}Query`] = Message;
    queryHandlers.push([Message, Handler]);
  }

  return Object.freeze({ name, ...messages, commandHandlers, queryHandlers });
}

module.exports = { defineContext };
