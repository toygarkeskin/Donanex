#!/usr/bin/env node
"use strict";

/**
 * Docker OLMADAN geliştirme için: nginx/default.conf ile aynı yönlendirmeyi uygular.
 * Kullanım:  npm run dev   (frontend klasöründe)
 * Ayarlar:   WEB_PORT (varsayılan 8080), BACKEND_URL (varsayılan http://127.0.0.1:3000)
 */

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.WEB_PORT || 8080);
const BACKEND = new URL(process.env.BACKEND_URL || "http://127.0.0.1:3000");
const ROOT = path.resolve(__dirname, "../public");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf"
};

function proxy(req, res) {
  const upstream = http.request(
    {
      hostname: BACKEND.hostname,
      port: BACKEND.port,
      path: req.url,
      method: req.method,
      // Host korunur: backend'in Origin denetimi tarayıcının gördüğü adresle karşılaştırır.
      headers: req.headers
    },
    (up) => {
      res.writeHead(up.statusCode, up.headers);
      up.pipe(res);
    }
  );
  upstream.on("error", () => {
    res.writeHead(502, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ success: false, message: "Backend'e ulaşılamadı." }));
  });
  req.pipe(upstream);
}

function resolveFile(pathname) {
  if (pathname === "/") return "pages/anasayfa.html";
  const page = pathname.match(/^\/([a-z0-9-]+)(\.html)?$/);
  if (page) return `pages/${page[1]}.html`;
  return pathname.startsWith("/assets/") ? pathname.slice(1) : null;
}

function serveStatic(req, res) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, "http://x").pathname);
  } catch {
    res.writeHead(400).end();
    return;
  }

  const relative = resolveFile(pathname);
  const file = relative ? path.join(ROOT, relative) : null;
  if (file && file.startsWith(ROOT + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile()) {
    res.writeHead(200, {
      "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-cache"
    });
    fs.createReadStream(file).pipe(res);
    return;
  }
  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("404 - Bulunamadı");
}

http
  .createServer((req, res) => (req.url.startsWith("/api/") ? proxy(req, res) : serveStatic(req, res)))
  .listen(PORT, () => {
    console.log(`Frontend: http://localhost:${PORT}  (API → ${BACKEND.origin})`);
  });
