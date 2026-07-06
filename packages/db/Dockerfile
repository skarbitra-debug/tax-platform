# syntax=docker/dockerfile:1
# ============================================================
# migrate — one-shot образ: prisma migrate deploy && seed.
# Сид ОБЯЗАТЕЛЕН в прод-цепочке: без него на чистом VPS нет
# ни админа, ни статусов — воронка мертва (план §5).
# Контекст сборки — КОРЕНЬ репо. Лёгкий образ без pnpm-workspace:
# зависимости ставятся npm-ом, чтобы не тянуть весь монорепо.
# ВАЖНО: seed.ts должен использовать ОТНОСИТЕЛЬНЫЕ импорты
# (../generated/client, ../src/...), не @tax/* — workspace тут нет.
# ============================================================

FROM node:22-alpine
RUN apk add --no-cache libc6-compat
WORKDIR /app
ENV NODE_ENV=production

# минимальный манифест: npm спотыкается о workspace:*-зависимости,
# поэтому package.json пакета db НЕ копируем
RUN printf '{"name":"tax-migrate","private":true}' > package.json

# та же мажорная линия версий, что в packages/db (контракт плана §1):
# prisma/@prisma/client ^6, tsx ^4, zod ^3.24;
# @node-rs/argon2 ^2 — нативный модуль для argon2id в сиде,
# npm на alpine сам подтянет prebuilt *-linux-x64-musl
RUN npm install --no-audit --no-fund \
    prisma@^6 @prisma/client@^6 tsx@^4 zod@^3.24 @node-rs/argon2@^2

# схема + миграции + сид (prisma/seed.ts) + src (реэкспорт generated-клиента)
COPY packages/db/prisma ./prisma
COPY packages/db/src ./src

# генерация клиента: output = "../generated/client" → /app/generated/client;
# БД для generate не нужна, DATABASE_URL придёт в рантайме из compose
RUN npx prisma generate

# migrate deploy — идемпотентен; seed — идемпотентен (upsert-only, план §2)
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx prisma/seed.ts"]
