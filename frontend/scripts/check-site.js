"use strict";

/**
 * Statik site denetimi:
 *  - HTML ve CSS'teki yerel bağlantılar gerçekten var mı?
 *  - CSP'nin engelleyeceği satır içi script/stil/olay kullanılmış mı?
 *  - Harici script var mı?
 */
const fs = require("fs");
const path = require("path");

const PUBLIC = path.resolve(__dirname, "../public");
const PAGES = path.join(PUBLIC, "pages");
const problems = [];

function walk(dir, ext) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "vendor" ? [] : walk(full, ext);
    return full.endsWith(ext) ? [full] : [];
  });
}

function exists(url) {
  const clean = decodeURI(url.split(/[?#]/)[0]);
  if (clean === "/" || clean === "/admin") return true;
  if (clean.startsWith("/assets/vendor/")) return true; // derleme sırasında üretilir
  if (clean.startsWith("/assets/")) return fs.existsSync(path.join(PUBLIC, clean));
  return fs.existsSync(path.join(PAGES, `${clean.replace(/^\//, "").replace(/\.html$/, "")}.html`));
}

for (const file of walk(PAGES, ".html")) {
  const name = path.basename(file);
  const source = fs.readFileSync(file, "utf8");

  for (const [, url] of source.matchAll(/(?:href|src)="(\/[^"]*)"/g)) {
    if (!exists(url)) problems.push(`${name}: kırık bağlantı ${url}`);
  }
  if (/<script(?![^>]*\bsrc=)[^>]*>/i.test(source)) problems.push(`${name}: satır içi <script>`);
  if (/<style/i.test(source)) problems.push(`${name}: satır içi <style>`);
  if (/\sstyle="/i.test(source)) problems.push(`${name}: style niteliği`);
  if (/\son[a-z]+="/i.test(source)) problems.push(`${name}: satır içi olay`);
  if (/<script[^>]*src="https?:/i.test(source)) problems.push(`${name}: harici script`);
}

for (const file of walk(path.join(PUBLIC, "assets/css"), ".css")) {
  for (const [, url] of fs.readFileSync(file, "utf8").matchAll(/url\(["']?(\/[^"')]+)["']?\)/g)) {
    if (!exists(url)) problems.push(`${path.basename(file)}: kırık url ${url}`);
  }
}

for (const file of walk(path.join(PUBLIC, "assets/js"), ".js")) {
  const source = fs.readFileSync(file, "utf8");
  for (const [, url] of source.matchAll(/href="(\/[a-z-]+\.html)"/g)) {
    if (!exists(url)) problems.push(`${path.basename(file)}: kırık bağlantı ${url}`);
  }
  for (const [, specifier] of source.matchAll(/(?:from |import )"(\.[^"]+)"/g)) {
    if (!fs.existsSync(path.resolve(path.dirname(file), specifier))) {
      problems.push(`${path.basename(file)}: bulunamayan modül ${specifier}`);
    }
  }
}

if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log("Site denetimi temiz.");
