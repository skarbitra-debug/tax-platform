#!/usr/bin/env bash
# ============================================================
# Бэкап Postgres: pg_dump через docker compose exec, gzip,
# ретенция 14 дней. Запуск из cron под deploy-юзером (в группе docker):
#   0 3 * * * /opt/tax-platform/infra/backup/pg-backup.sh >> /var/log/pg-backup.log 2>&1
# DoD (план M0-12): restore проверен именно из cron-окружения.
# ============================================================

# ПЕРВОЙ строкой — сорсинг env: cron-окружение пустое (грабля из ревью),
# без этого POSTGRES_USER/POSTGRES_DB не определены
set -a; . /opt/tax-platform/.env; set +a
set -euo pipefail

PROJECT_DIR=/opt/tax-platform
BACKUP_DIR="$PROJECT_DIR/backups"
COMPOSE="docker compose -f $PROJECT_DIR/docker-compose.prod.yml"
STAMP="$(date +%Y%m%d-%H%M%S)"
FILE="$BACKUP_DIR/tax-$STAMP.sql.gz"

umask 027
mkdir -p "$BACKUP_DIR"

# -T обязателен: без TTY в cron docker compose exec падает
$COMPOSE exec -T postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" | gzip > "$FILE"

# верификация: целостность архива + дамп не пустой
gzip -t "$FILE"
[ "$(stat -c%s "$FILE")" -gt 1024 ] || { echo "ОШИБКА: дамп подозрительно мал: $FILE" >&2; exit 1; }

# ретенция: дампы старше 14 дней удаляются
find "$BACKUP_DIR" -name 'tax-*.sql.gz' -mtime +14 -delete

echo "OK: $FILE ($(stat -c%s "$FILE") байт)"
