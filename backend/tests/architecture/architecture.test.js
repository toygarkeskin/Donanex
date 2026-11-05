"use strict";

/**
 * Mimari kuralları BURADA test edilir.
 *
 * Belgeye yazılan bir kural zamanla çürür; teste yazılan kural çiğnendiğinde
 * derleme kırılır. Bu dosya Clean Architecture'ın bağımlılık yönünü ve
 * CQRS'in komut/sorgu ayrımını koruyan bekçidir.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const SRC = path.resolve(__dirname, "../../src");
const { PORTS, assertPorts } = require("../../src/application/shared/ports");

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.name.endsWith(".js") ? [full] : [];
  });
}

const rel = (file) => path.relative(SRC, file).split(path.sep).join("/");

/** Dosyanın require ettiği hedefleri, göreli olanları SRC köküne çevirerek verir. */
function requiresOf(file) {
  const source = fs.readFileSync(file, "utf8");
  return [...source.matchAll(/require\("([^"]+)"\)/g)].map(([, target]) => {
    if (!target.startsWith(".")) return { external: true, target };
    return { external: false, target: rel(path.resolve(path.dirname(file), target)) };
  });
}

const files = walk(SRC);
const inLayer = (layer) => files.filter((file) => rel(file).startsWith(`${layer}/`));

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
    const source = fs.readFileSync(file, "utf8");

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

  const { Command, Query } = require("../../src/application/shared/cqrs/Message");
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
  const { CommandBus, QueryBus } = require("../../src/application/shared/cqrs/bus");
  const { Command, Query } = require("../../src/application/shared/cqrs/Message");

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
  assert.throws(() => assertPorts({}), /Port sözleşmesi karşılanmıyor/);
  assert.throws(
    () => assertPorts({ ...Object.fromEntries(Object.keys(PORTS).map((key) => [key, {}])) }),
    /eksik|fonksiyon/
  );
  assert.ok(PORTS.unitOfWork.includes("run"));
});

test("SQL yalnızca repository ve read model dosyalarında bulunur", () => {
  const sqlPattern = /\b(SELECT|INSERT INTO|UPDATE\s+\w+\s+SET|DELETE FROM)\b/;
  // Yorumlar elenir: bir açıklamada "SELECT ... FOR UPDATE" geçmesi kural ihlali değildir.
  const withoutComments = (source) =>
    source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  for (const file of files) {
    const name = rel(file);
    if (/^infrastructure\/persistence\//.test(name) || name.startsWith("bootstrap/")) continue;
    assert.ok(
      !sqlPattern.test(withoutComments(fs.readFileSync(file, "utf8"))),
      `${name}: SQL yalnızca persistence katmanında olmalı`
    );
  }
});
