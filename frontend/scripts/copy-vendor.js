"use strict";

/** Tarayıcıya gidecek üçüncü taraf dosyaları node_modules'tan hedef klasöre kopyalar. */
const fs = require("fs");
const path = require("path");

const target = path.resolve(process.argv[2] || "public/assets/vendor");
const modules = path.resolve(__dirname, "../node_modules");

const FILES = [
  ["bootstrap/dist/css/bootstrap.min.css", "bootstrap/css/bootstrap.min.css"],
  ["bootstrap/dist/js/bootstrap.bundle.min.js", "bootstrap/js/bootstrap.bundle.min.js"],
  ["bootstrap-icons/font/bootstrap-icons.min.css", "bootstrap-icons/font/bootstrap-icons.min.css"],
  ["bootstrap-icons/font/fonts", "bootstrap-icons/font/fonts"],
  ["@fortawesome/fontawesome-free/css/all.min.css", "fontawesome/css/all.min.css"],
  ["@fortawesome/fontawesome-free/webfonts", "fontawesome/webfonts"]
];

for (const [from, to] of FILES) {
  fs.cpSync(path.join(modules, from), path.join(target, to), { recursive: true });
}
console.log(`Üçüncü taraf dosyalar kopyalandı: ${target}`);
