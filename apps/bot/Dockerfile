# syntax=docker/dockerfile:1
# ============================================================
# apps/bot — grammY, long polling (порты/TLS не нужны).
# Контекст сборки — КОРЕНЬ репо (см. docker-compose.prod.yml).
#
# ОБРАЗ: node:22-slim (Debian/glibc), НЕ alpine — onnxruntime-node (движок
# Whisper STT, §4.7) не имеет musl-сборок и на alpine падает при загрузке.
# Prisma-движок при этом тоже debian-openssl (генерируется в этой же базе).
#
# ДЕТЕРМИНИРОВАННАЯ последовательность (грабля из ревью:
# никаких COPY --from=build внутри самой стадии build):
#   install --filter → prisma generate → tsup build →
#   pnpm deploy --prod в /out → cp dist/generated в /out →
#   runner делает ОДНУ COPY --from=build /out.
# ============================================================

FROM node:22-slim AS base
RUN corepack enable
WORKDIR /app

# ---------- build ----------
FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
# манифесты всех workspace-пакетов — иначе frozen-lockfile не сойдётся
COPY apps/web/package.json apps/web/
COPY apps/bot/package.json apps/bot/
COPY packages/db/package.json packages/db/
COPY packages/core/package.json packages/core/
COPY packages/crypto/package.json packages/crypto/
COPY packages/config/package.json packages/config/
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter @tax/bot...
COPY packages ./packages
COPY apps/bot ./apps/bot
# клиент Prisma → packages/db/generated (нужен tsup-сборке и рантайму)
RUN pnpm db:generate
# tsup → apps/bot/dist (@xenova/transformers остаётся external, не бандлится)
RUN pnpm --filter @tax/bot build
# прод-деплой пакета с РАЗВЁРНУТЫМИ прод-зависимостями в /out
# (--legacy: в pnpm 10+ deploy без inject-workspace-packages требует этот флаг)
RUN pnpm --filter @tax/bot deploy --prod --legacy /out
# dist и сгенерированный клиент pnpm deploy не захватывает — кладём руками;
# rm -rf до cp: если deploy что-то скопировал, cp вложил бы dist/dist
RUN rm -rf /out/dist /out/generated \
    && cp -r apps/bot/dist /out/dist \
    && cp -r packages/db/generated /out/generated

# ---------- runner ----------
FROM node:22-slim AS runner
# ffmpeg — декод голосовых Telegram (OGG/Opus → PCM) для Whisper STT (§4.7)
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
# Кэш моделей Whisper (@xenova/transformers) — на volume, чтобы не качать при
# каждом рестарте (см. docker-compose.prod.yml: volume whisper_cache)
ENV TRANSFORMERS_CACHE=/app/.cache/transformers
COPY --from=build --chown=node:node /out ./
RUN mkdir -p /app/.cache/transformers && chown -R node:node /app/.cache
USER node
CMD ["node", "dist/index.js"]
