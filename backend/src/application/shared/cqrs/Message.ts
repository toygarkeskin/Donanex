"use strict";

/**
 * Komut ve sorgu mesajlarının ortak atası.
 *
 *   Command — sistemin durumunu DEĞİŞTİRİR.
 *   Query   — yalnızca OKUR, hiçbir şeyi değiştirmez.
 *
 * Ayrım yalnızca isimlendirme değildir: CommandBus'a sorgu, QueryBus'a komut
 * gönderilemez (bus kayıt sırasında türü denetler) ve mimari testi komut
 * handler'ının read model'e, sorgu handler'ının unit of work'e dokunmasını engeller.
 */
export class Command {
  static get messageKind(): "command" {
    return "command";
  }
}

export class Query {
  static get messageKind(): "query" {
    return "query";
  }
}

/**
 * Handler sözleşmesi.
 *
 * TMessage girdinin, TResult çıktının tipidir; böylece bir handler'ın yanlış
 * mesajla ya da yanlış dönüş tipiyle yazılması derlemede yakalanır.
 */
export interface Handler<TMessage, TResult = unknown, TContext = unknown> {
  handle(message: TMessage, context: TContext): Promise<TResult> | TResult;
}
