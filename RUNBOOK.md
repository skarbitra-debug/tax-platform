# RUNBOOK — эксплуатация платформы (прод-VPS)

Все команды — на VPS из `/opt/tax-platform`, если не сказано иное.

## 1. Первичный провижининг VPS (один раз)

Ubuntu 24.04 LTS, зарубежный хостинг. Под root:

```bash
# deploy-юзер, вход только по SSH-ключу
adduser --disabled-password deploy
mkdir -p /home/deploy/.ssh
cp ~/.ssh/authorized_keys /home/deploy/.ssh/ && chown -R deploy:deploy /home/deploy/.ssh
# запретить root-логин и пароли
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/; s/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart ssh

# firewall: только 22/80/443
apt update && apt install -y ufw fail2ban
ufw default deny incoming && ufw default allow outgoing
ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp
ufw enable
systemctl enable --now fail2ban   # дефолтный jail sshd достаточен

# Docker (официальный скрипт) + права deploy-юзеру
curl -fsSL https://get.docker.com | sh
usermod -aG docker deploy
```

Под `deploy`:

```bash
sudo mkdir -p /opt/tax-platform && sudo chown deploy:deploy /opt/tax-platform
git clone <repo-url> /opt/tax-platform
cd /opt/tax-platform

cp .env.example .env && chmod 600 .env
# заполнить .env:
#   DOMAIN, APP_URL=https://<домен>
#   POSTGRES_PASSWORD — стойкий; DATABASE_URL с хостом postgres:
#     postgresql://tax:<пароль>@postgres:5432/tax
#   AUTH_SECRET:         openssl rand -base64 33
#   FNS_ENCRYPTION_KEY:  openssl rand -base64 32
#     КОПИЮ ключа — в оффлайн-хранилище: потеря = потеря всех логинов ФНС
#   ADMIN_EMAIL / ADMIN_INITIAL_PASSWORD (сид Татьяны; пароль сменить после первого входа)
#   TELEGRAM_BOT_TOKEN — от @BotFather
#   TELEGRAM_CHANNEL_ID — канал исполнительниц (-100…). БЕЗ него передача
#     заявок девочкам (§4.5) МОЛЧА выключена — заявки видны только в ЛК!
#   TELEGRAM_ADMIN_CHAT_ID — chat_id Татьяны (голосовое управление §4.7)
#   ANTHROPIC_API_KEY — разбор голосовых команд (§4.7)

# DNS: A-запись домена → IP VPS (до первого деплоя, иначе ACME не выдаст сертификат)

chmod +x deploy.sh infra/backup/pg-backup.sh
./deploy.sh

# бэкап-cron (crontab -e под deploy):
# 0 3 * * * /opt/tax-platform/infra/backup/pg-backup.sh >> /var/log/pg-backup.log 2>&1
sudo touch /var/log/pg-backup.log && sudo chown deploy:deploy /var/log/pg-backup.log
```

Проверка: `https://<домен>` открывается с валидным сертификатом, логин админа работает, `docker compose -f docker-compose.prod.yml ps` — все сервисы `running/healthy`, `migrate` — `exited (0)`. **Плюс сквозная проверка §4.5:** отправить тестовую заявку по реф-ссылке и убедиться, что она появилась в Telegram-канале исполнительниц (в карточке сделки — бейдж «Передана в канал»; если «НЕ передана» — проверить TELEGRAM_CHANNEL_ID и логи web).

## 2. Деплой

```bash
./deploy.sh
```

Делает: `git reset --hard origin/main` → `compose build` → `up -d --remove-orphans` (postgres → migrate: миграции + сид → web + bot → caddy) → `image prune`.

## 3. Откат на коммит

```bash
git reset --hard <commit>
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d --remove-orphans
```

ВАЖНО: откатывается только код — `prisma migrate deploy` миграции назад не откатывает. Если сломавший релиз содержал миграцию, несовместимую со старым кодом, — восстановление БД из бэкапа (§5) на момент до релиза.

## 4. Логи

```bash
docker compose -f docker-compose.prod.yml logs -f web      # Next.js
docker compose -f docker-compose.prod.yml logs -f bot      # grammY
docker compose -f docker-compose.prod.yml logs migrate     # миграции + сид последнего деплоя
docker compose -f docker-compose.prod.yml logs -f caddy    # доступ/TLS
tail -f /var/log/pg-backup.log                             # бэкапы
```

В логи не должны попадать телефоны/ФИО/логины ФНС (§7 ТЗ) — заметил ПД в логах → баг, чинить немедленно.

## 5. Бэкап и восстановление

Дампы: `/opt/tax-platform/backups/tax-YYYYMMDD-HHMMSS.sql.gz`, cron 03:00, ретенция 14 дней.

Ручной бэкап: `./infra/backup/pg-backup.sh`

Проверка restore (DoD M0-12 — выполнить с дампом, созданным именно cron-ом):

```bash
C="docker compose -f docker-compose.prod.yml"
$C exec -T postgres psql -U $POSTGRES_USER -d postgres -c 'DROP DATABASE IF EXISTS tax_restore_check; CREATE DATABASE tax_restore_check;'
gunzip -c backups/tax-<дата>.sql.gz | $C exec -T postgres psql -U $POSTGRES_USER -d tax_restore_check
$C exec -T postgres psql -U $POSTGRES_USER -d tax_restore_check -c 'SELECT count(*) FROM "User"; SELECT count(*) FROM "Deal";'
$C exec -T postgres psql -U $POSTGRES_USER -d postgres -c 'DROP DATABASE tax_restore_check;'
```

Боевое восстановление — то же самое в основную БД: остановить web/bot (`$C stop web bot`), пересоздать БД, залить дамп, `$C start web bot`.

## 6. Разделение контуров ПД (§7 ТЗ)

Два РАЗНЫХ VPS:

1. **Платформа** (этот RUNBOOK) — БД с ПД клиентов, web, bot.
2. **AI-офис Татьяны** — отдельная машина; у неё НЕТ `DATABASE_URL`, НЕТ SSH-ключей платформы, НЕТ доступа к бэкапам.

Инварианты: Postgres не публикует порт и живёт в internal-сети без выхода наружу; в промпты Claude уходят только номера сделок и статусы — никаких телефонов/ФИО; `.env` — `chmod 600`, только deploy-юзер.
