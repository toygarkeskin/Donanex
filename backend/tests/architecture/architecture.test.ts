"use strict";

/**
 * Mimari kuralları BURADA test edilir.
 *
 * Belgeye yazılan bir kural zamanla çürür; teste yazılan kural çiğnendiğinde
 * derleme kırılır. Bu dosya Clean Architecture'ın bağımlılık yönünü ve
 * CQRS'in komut/sorgu ayrımını koruyan bekçidir.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

const SRC = path.resolve(__dirname, "../../src");
import { PORTS, assertPorts } from "../../src/application/shared/ports";
import { Command, Query } from "../../src/application/shared/cqrs/Message";
import { CommandBus, QueryBus } from "../../src/application/shared/cqrs/bus";

/**
 * Kaynak dosyalari toplar.
 *
 * Hem ".ts" hem ".js" kabul edilir. Bu testler normalde DERLENMİŞ çıktıya
 * karşı koşar (.build/src); orada dosyalar ".js" olur ve bağımlılıklar
 * require() biçimindedir. İkisini birden desteklemek, testin doğrudan kaynak
 * ağacına karşı çalıştırıldığında da gerçek dosyaları görmesini sağlar —
 * tek bir uzantıya bağlı kalmak, kuralların sessizce sıfır dosya üzerinde
 * dönmesi riskini taşır.
 */
const UZANTILAR = [".js", ".ts"];

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    if (entry.name.endsWith(".d.ts")) return [];
    return UZANTILAR.some((uzanti) => entry.name.endsWith(uzanti)) ? [full] : [];
  });
}

const rel = (file: string) => path.relative(SRC, file).split(path.sep).join("/");

/*
 * Yorumlar elenir: bir AÇIKLAMADA "unitOfWork" ya da "SELECT ... FOR UPDATE"
 * geçmesi kural ihlali değildir. Kural kodu bağlar, açıklama metnini değil.
 */
const withoutComments = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/**
 * Dosyanın bağımlı olduğu hedefleri, göreli olanları SRC köküne çevirerek verir.
 *
 * Hem CommonJS require hem ES import/export yakalanır, böylece test
 * derlenmiş çıktıya da kaynak ağacına da uygulanabilir.
 *
 * ES desenleri SATIR BAŞINA sabitlenmiştir. Sabitlenmezse repository'lerdeki
 * SQL içindeki `FROM "sutun"` gibi parçalar bağımlılık sanılır ve test
 * uydurma sonuçlar üzerinde karar verir.
 *
 * "import type" de dahildir: tip içe aktarması derlenmiş çıktıda yer almaz,
 * ama katman kuralı derleme zamanı bağımlılığını da kapsar — presentation'ın
 * infrastructure'ın iç tiplerini tanıması, o dosyaya bağlanması demektir.
 */
const BAGIMLILIK_DESENLERI = [
  /\brequire\s*\(\s*"([^"]+)"\s*\)/g,
  /^\s*(?:import|export)\s[^;\n]*?\bfrom\s*"([^"]+)"/gm,
  /^\s*import\s*"([^"]+)"/gm
];

function requiresOf(file: string) {
  const source = fs.readFileSync(file, "utf8");
  const hedefler = BAGIMLILIK_DESENLERI.flatMap((desen) =>
    [...source.matchAll(desen)].map(([, target]) => target)
  );
  return hedefler.map((target) => {
    if (!target.startsWith(".")) return { external: true, target };
    return { external: false, target: rel(path.resolve(path.dirname(file), target)) };
  });
}

const files = walk(SRC);
const inLayer = (layer: string) => files.filter((file) => rel(file).startsWith(`${layer}/`));

test("domain hiçbir şeye bağımlı değildir", () => {
  for (const file of inLayer("domain")) {
    for (const dependency of requiresOf(file)) {
      assert.ok(
        !dependency.external && dependency.target.startsWith("domain/"),
        `${rel(file)} -> ${dependency.target} (domain yalnızca domain'e bakabilir)`
      );
    }
  }
});

test("application yalnızca application ve domain'e bağımlıdır", () => {
  for (const file of inLayer("application")) {
    for (const dependency of requiresOf(file)) {
      assert.ok(
        !dependency.external && /^(application|domain)\//.test(dependency.target),
        `${rel(file)} -> ${dependency.target} (application altyapı tanımaz)`
      );
    }
  }
});

test("infrastructure, application ve presentation'a bağımlı değildir", () => {
  for (const file of inLayer("infrastructure")) {
    for (const dependency of requiresOf(file)) {
      assert.ok(
        !/^(application|presentation|bootstrap)\//.test(dependency.target),
        `${rel(file)} -> ${dependency.target} (bağımlılık yönü içeri doğrudur)`
      );
    }
  }
});

test("presentation altyapıya ve veritabanı istemcisine dokunmaz", () => {
  for (const file of inLayer("presentation")) {
    for (const dependency of requiresOf(file)) {
      assert.ok(
        !dependency.target.startsWith("infrastructure/"),
        `${rel(file)} -> ${dependency.target} (rotalar somut altyapı tanımaz)`
      );
      assert.notEqual(dependency.target, "pg", `${rel(file)} doğrudan pg kullanıyor`);
    }
  }
});

test("presentation yalnızca bağlamların public index'ini kullanır", () => {
  for (const file of inLayer("presentation")) {
    for (const dependency of requiresOf(file)) {
      if (!dependency.target.startsWith("application/")) continue;
      assert.match(
        dependency.target,
        /^application\/[a-z]+$/,
        `${rel(file)} -> ${dependency.target} (kullanım senaryosuna doğrudan erişilmez)`
      );
    }
  }
});

test("CQRS: komut handler'ı read model, sorgu handler'ı unit of work kullanamaz", () => {
  for (const file of inLayer("application")) {
    const name = rel(file);
    const source = withoutComments(fs.readFileSync(file, "utf8"));

    if (name.includes("/commands/")) {
      assert.ok(!/ReadModel/.test(source), `${name}: komut tarafı read model kullanıyor`);
    }
    if (name.includes("/queries/")) {
      assert.ok(!/unitOfWork/.test(source), `${name}: sorgu tarafı unit of work kullanıyor`);
    }
  }
});

test("CQRS: her komut Command'dan, her sorgu Query'den türer ve kayıtlıdır", () => {
  const contexts = fs
    .readdirSync(path.join(SRC, "application"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== "shared")
    .map((entry) => entry.name);

  assert.ok(contexts.length >= 5, `en az 5 bağlam beklenir, ${contexts.length} bulundu`);

  let useCases = 0;

  for (const context of contexts) {
    const module = require(path.join(SRC, "application", context));

    for (const [Message, Handler] of module.commandHandlers) {
      assert.ok(Message.prototype instanceof Command, `${Message.name} bir Command olmalı`);
      assert.equal(typeof Handler.prototype.handle, "function", `${Handler.name}.handle() yok`);
      assert.match(Message.name, /Command$/, `${Message.name} "Command" ile bitmeli`);
      useCases++;
    }
    for (const [Message, Handler] of module.queryHandlers) {
      assert.ok(Message.prototype instanceof Query, `${Message.name} bir Query olmalı`);
      assert.equal(typeof Handler.prototype.handle, "function", `${Handler.name}.handle() yok`);
      assert.match(Message.name, /Query$/, `${Message.name} "Query" ile bitmeli`);
      useCases++;
    }
  }

  assert.ok(useCases >= 50, `en az 50 kullanım senaryosu beklenir, ${useCases} bulundu`);
});

test("Bus yanlış türdeki mesajı reddeder", () => {

  class SahteKomut extends Command {}
  class SahteSorgu extends Query {}
  const handler = { handle: () => null };

  assert.throws(() => new CommandBus().register(SahteSorgu, handler), /Command olmalı/);
  assert.throws(() => new QueryBus().register(SahteKomut, handler), /Query olmalı/);
  assert.throws(
    () => new CommandBus().register(SahteKomut, handler).register(SahteKomut, handler),
    /zaten/
  );
});

test("Port sözleşmesi eksik adaptörü açılışta yakalar", () => {
  // Buradaki donusumler KASTEN gecersiz girdi veriyor: sinanan sey tam da
  // assertPorts in sozlesmeyi karsilamayan bir torbayi aciklista yakalamasi.
  assert.throws(() => assertPorts({} as never), /Port sözleşmesi karşılanmıyor/);
  assert.throws(
    () => assertPorts(Object.fromEntries(Object.keys(PORTS).map((key) => [key, {}])) as never),
    /eksik|fonksiyon/
  );
  assert.ok(PORTS.unitOfWork.includes("run"));
});

test("SQL yalnızca repository ve read model dosyalarında bulunur", () => {
  const sqlPattern = /\b(SELECT|INSERT INTO|UPDATE\s+\w+\s+SET|DELETE FROM)\b/;
  for (const file of files) {
    const name = rel(file);
    if (/^infrastructure\/persistence\//.test(name) || name.startsWith("bootstrap/")) continue;
    assert.ok(
      !sqlPattern.test(withoutComments(fs.readFileSync(file, "utf8"))),
      `${name}: SQL yalnızca persistence katmanında olmalı`
    );
  }
});
