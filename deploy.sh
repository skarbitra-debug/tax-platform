#!/usr/bin/env bash
# ============================================================
# Деплой одной командой (запускать на VPS из /opt/tax-platform).
# Порядок стартов гарантирует compose: postgres(healthy) →
# migrate(deploy && seed, exit 0) → web+bot → caddy.
# Откат — см. RUNBOOK.md («Откат на коммит»).
# ============================================================
set -euo pipefail

cd "$(dirname "$0")"

# код строго из origin/main — локальные правки на VPS запрещены
git fetch origin
git reset --hard origin/main

docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d --remove-orphans

# подчистить осиротевшие слои старых сборок
docker image prune -f

docker compose -f docker-compose.prod.yml ps
