# ---- Üretim bağımlılıkları ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ---- Tüm bağımlılıklar (TypeScript derleyicisi ve tipler dahil) ----
FROM node:22-alpine AS devdeps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci && npm cache clean --force

# ---- Derleme: TypeScript -> dist/ ----
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=devdeps /app/node_modules ./node_modules
COPY package.json tsconfig.json tsconfig.build.json ./
COPY src ./src
COPY scripts ./scripts
# "build" önce tsc'yi, sonra .sql göç dosyalarını kopyalayan adımı çalıştırır.
# tsc yalnızca kod üretir; migrations/ elle taşınmazsa açılışta şema kurulamaz.
RUN npm run build

# ---- Testler (docker-compose.test.yml kullanır) ----
# Testler derlenmiş çıktıyı değil KAYNAĞI çalıştırır: Node 22.18+ TypeScript'i
# doğrudan çalıştırabiliyor. Böylece mimari testi gerçek kaynak dosyalarını
# okur ve hata izleri derlenmiş satır numaralarını değil kaynağı gösterir.
FROM node:22-alpine AS test
WORKDIR /app
COPY --from=devdeps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json tsconfig.json tsconfig.build.json ./
COPY --chown=node:node src ./src
COPY --chown=node:node tests ./tests
COPY --chown=node:node scripts ./scripts
# tsc, testlerden önce .build/ klasörünü yazar. Konteyner root olmayan
# kullanıcıyla koştuğu için klasör önceden onun adına açılmalı; yoksa
# derleme "mkdir /app/.build: permission denied" ile düşer.
RUN mkdir -p /app/.build && chown -R node:node /app
USER node
CMD ["npm", "test"]

# ---- Çalışma imajı: yalnızca derlenmiş kod, root olmayan kullanıcı ----
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
# Kaynak değil, derlenmiş çıktı: imajda ne TypeScript derleyicisi ne de .ts dosyası kalır.
COPY --from=build --chown=node:node /app/dist ./dist
# Klasörler imajda ÖNCEDEN oluşturulur ve node'a verilir. Docker bir named
# volume'u ilk kez bağlarken imajdaki dizinin sahipliğini kopyalar; klasör
# imajda yoksa volume root'a ait olarak doğar ve root olmayan süreç yazamaz.
RUN mkdir -p /app/var/uploads && chown -R node:node /app/var

USER node
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=3s --start-period=40s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/main.js"]
