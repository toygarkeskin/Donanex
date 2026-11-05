"use strict";

/**
 * Clean Architecture ve CQRS kuralları burada TEST edilir; kural çiğnenirse test kırılır.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const SRC = path.resolve(__dirname, "../../src");
const { PORTS } = require("../../src/application/shared/ports");

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : full.endsWith(".js") ? [full] : [];
  });
}

const rel = (file) => path.relative(SRC, file).split(path.sep).join("/");

function requiresOf(file) {
  const source = fs.readFileSync(file, "utf8");
  return [...source.matchAll(/require\("([^"]+)"\)/g)].map(([, target]) => {
    if (!target.startsWith(".")) return { external: true, target };
    return { external: false, target: rel(path.resolve(path.dirname(file), target)) };
  });
}

const files = walk(SRC);
const inLayer = (layer) => files.filter((f) => rel(f).startsWith(`${layer}/`));

test("domain hiçbir şeye bağımlı değildir (yalnızca domain)", () => {
  for (const file of inLayer("domain")) {
    for (const dep of requiresOf(file)) {
      assert.ok(!dep.external && dep.target.startsWith("domain/"), `${rel(file)} -> ${dep.target}`);
    }
  }
});

test("application yalnızca application ve domain'e bağımlıdır", () => {
  for (const file of inLayer("application")) {
    for (const dep of requiresOf(file)) {
      assert.ok(
        !dep.external && /^(application|domain)\//.test(dep.target),
        `${rel(file)} -> ${dep.target}`
      );
    }
  }
});

test("infrastructure, application veya presentation'a bağımlı değildir", () => {
  for (const file of inLayer("infrastructure")) {
    for (const dep of requiresOf(file)) {
      assert.ok(!/^(application|presentation|bootstrap)\//.test(dep.target), `${rel(file)} -> ${dep.target}`);
    }
  }
});

test("presentation altyapıya dokunmaz, veritabanı istemcisi görmez", () => {
  for (const file of inLayer("presentation")) {
    for (const dep of requiresOf(file)) {
      assert.ok(!dep.target.startsWith("infrastructure/"), `${rel(file)} -> ${dep.target}`);
      assert.notEqual(dep.target, "pg", rel(file));
    }
  }
});

test("presentation yalnızca bağlam index'lerini kullanır", () => {
  for (const file of inLayer("presentation")) {
    for (const dep of requiresOf(file)) {
      if (dep.target.startsWith("application/")) {
        assert.match(dep.target, /^application\/[a-z]+$/, `${rel(file)} -> ${dep.target}`);
      }
    }
  }
});

test("CQRS: komut handler'ı read model, sorgu handler'ı unit of work kullanamaz", () => {
  for (const file of inLayer("application")) {
    const name = rel(file);
    const source = fs.readFileSync(file, "utf8");
    if (name.includes("/commands/")) assert.ok(!/ReadModel/.test(source), `${name} read model kullanıyor`);
    if (name.includes("/queries/")) assert.ok(!/unitOfWork/.test(source), `${name} unit of work kullanıyor`);
  }
});

test("CQRS: her kullanım senaryosu kendi klasöründe mesaj + handler çiftidir", () => {
  const contexts = fs.readdirSync(path.join(SRC, "application"), { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== "shared")
    .map((d) => d.name);
  assert.ok(contexts.length >= 5);

  let useCases = 0;
  for (const context of contexts) {
    const contextDir = path.join(SRC, "application", context);
    const module = require(contextDir);
    const registered = new Set(
      [...module.commandHandlers, ...module.queryHandlers].map(([Message]) => Message.name)
    );

    for (const [kind, suffix] of [["commands", "Command"], ["queries", "Query"]]) {
      const dir = path.join(contextDir, kind);
      if (!fs.existsSync(dir)) continue;
      for (const useCase of fs.readdirSync(dir)) {
        const names = fs.readdirSync(path.join(dir, useCase)).sort();
        assert.deepEqual(names, [`${useCase}${suffix}.js`, `${useCase}Handler.js`].sort(), `${context}/${kind}/${useCase}`);
        assert.ok(registered.has(`${useCase}${suffix}`), `${useCase}${suffix} kayıtlı değil`);
        useCases++;
      }
    }
  }
  assert.ok(useCases >= 30, `kullanım senaryosu sayısı: ${useCases}`);
});

test("Port listesi gerçek adaptörlerle uyumludur", () => {
  assert.ok(PORTS.unitOfWork.includes("run"));
  const { assertPorts } = require("../../src/application/shared/ports");
  assert.throws(() => assertPorts({}), /Port bağlanmamış/);
});
