# ---- Üçüncü taraf CSS/JS: npm kilit dosyasından (bütünlük özetiyle) kurulur, CDN kullanılmaz ----
FROM node:22-alpine AS vendor
WORKDIR /app
COPY package.json package-lock.json ./
COPY scripts ./scripts
RUN npm ci --ignore-scripts && node scripts/copy-vendor.js /vendor

# ---- Root olmayan nginx ----
FROM nginxinc/nginx-unprivileged:1.29-alpine
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY public /usr/share/nginx/html
COPY --from=vendor /vendor /usr/share/nginx/html/assets/vendor

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/ >/dev/null || exit 1
