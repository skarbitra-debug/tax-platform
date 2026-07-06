# syntax=docker/dockerfile:1
# ============================================================
# apps/web — Next.js 15 standalone, multi-stage pnpm.
# Контекст сборки — КОРЕНЬ репо (см. docker-compose.prod.yml).
# Секреты в слои не попадают: .dockerignore режет .env*, .git.
# Порядок критичен: prisma generate ДО next build —
# сгенерированный клиент лежит в packages/db/generated.
# ============================================================

FROM node:22-alpine AS base
# libc6-compat — нативные модули (prisma engine, argon2) на musl
RUN apk add --no-cache libc6-compat && corepack enable
WORKDIR /app

# ---------- deps: только манифесты → кэш слоя install живёт долго ----------
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
# манифесты ВСЕХ workspace-пакетов: иначе frozen-lockfile не сойдётся с lock-файлом
COPY apps/web/package.json apps/web/
COPY apps/bot/package.json apps/bot/
COPY packages/db/package.json packages/db/
COPY packages/core/package.json packages/core/
COPY packages/crypto/package.json packages/crypto/
COPY packages/config/package.json packages/config/
# @tax/web... = web + все его workspace-зависимости
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter @tax/web...

# ---------- build: prisma generate → next build (standalone) ----------
FROM deps AS build
COPY tsconfig.base.json ./
COPY packages ./packages
COPY apps/web ./apps/web
# BUILD_STANDALONE — флаг для next.config.ts: standalone-вывод только в Docker
# (на Windows-хосте symlink без прав администратора падает с EPERM)
ENV NEXT_TELEMETRY_DISABLED=1 \
    BUILD_STANDALONE=1
# 1) клиент Prisma → packages/db/generated (БД для generate не нужна)
RUN pnpm db:generate
# 2) next build: output standalone + outputFileTracingRoot = корень репо,
#    поэтому в .next/standalone воспроизводится структура монорепо
RUN pnpm --filter @tax/web build

# ---------- runner: минимальный рантайм, без pnpm и исходников ----------
FROM node:22-alpine AS runner
RUN apk add --no-cache libc6-compat
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1
# standalone-дерево = корень репо: server.js лежит в apps/web/
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /app/apps/web/public ./apps/web/public
# страховка: file tracing иногда теряет нативный engine Prisma —
# кладём сгенерированный клиент по тому же относительному пути
COPY --from=build --chown=node:node /app/packages/db/generated ./packages/db/generated
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
