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
class Command {
  static get messageKind() {
    return "command";
  }
}

class Query {
  static get messageKind() {
    return "query";
  }
}

module.exports = { Command, Query };
