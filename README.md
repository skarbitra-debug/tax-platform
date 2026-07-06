# tax-platform

Платформа «Возврат налогов прошлых лет» (закрытый пилот). Канал — риэлторы с реферальными ссылками.

- **ТЗ**: `~/Desktop/2026-07-05-platform-TZ.md`
- **План M0–M1** (контракты, схема, задачи): `~/Desktop/2026-07-06-plan-M0-M1.md`

## Структура

```
apps/web        Next.js 15: витрина + ЛК риэлтора + ЛК админа + /r/[token] + Server Actions
apps/bot        grammY: Telegram-бот (long polling), общая БД через @tax/db
packages/db     Prisma-схема, миграции, seed (единственный источник правды по данным)
packages/core   бизнес-логика без UI: комиссии, статусы, рефералка
packages/crypto AES-256-GCM для логинов/паролей ЛК ФНС
packages/config Zod-валидация env (владелец env-контракта)
```

## Быстрый старт

```bash
pnpm install
cp .env.example .env        # заполнить AUTH_SECRET и прочее
docker compose up -d        # dev-Postgres (нужен Docker Desktop)
pnpm db:migrate && pnpm db:seed
pnpm dev                    # web:3000 + bot
```

Ключевые соглашения (деньги Decimal(14,2), реф-токен, статусы, env-словарь) — в плане, §1 «Единые контракты».
