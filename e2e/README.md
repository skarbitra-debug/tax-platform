# E2E-тесты воронки (Playwright, план M1-8)

Сквозной сценарий: логин риэлтора → реф-ссылка → анкета клиента в инкогнито →
заявка в ЛК риэлтора + негативы на мусорный токен. Один проект —
chromium с эмуляцией Pixel 7 (анкету открывают из Telegram-WebView с телефона).

**Важно:** тесты пишут в живую БД (создают Client/Deal) — гонять только на
dev-базе или стейдже, НЕ на проде.

## Предусловия

- Node 22+, pnpm, Docker (для локального Postgres)
- Зависимость `@playwright/test` в корне репо + браузер:
  `npx playwright install chromium`

## Запуск локально

```bash
# 1. Postgres из dev-compose
docker compose up -d postgres

# 2. Зависимости + миграции + seed С DEV-ДАННЫМИ (тестовый риэлтор
#    realtor.dev@example.com / dev-realtor-123 — на нём живёт сценарий)
pnpm install
pnpm db:migrate
SEED_DEV=1 pnpm db:seed        # PowerShell: $env:SEED_DEV="1"; pnpm db:seed

# 3. Web-сервер (руками)
pnpm dev:web

# 4. В соседнем терминале — тесты
E2E_BASE_URL=http://localhost:3000 npx playwright test
# PowerShell: $env:E2E_BASE_URL="http://localhost:3000"; npx playwright test
```

**Альтернатива — Playwright сам поднимет сервер** (как в CI): задать
`E2E_WEBSERVER=1` — тогда шаг 3 не нужен, сервер стартует на порту из
`E2E_BASE_URL` (Next читает `PORT`). Порт должен быть свободен, env web
(`AUTH_SECRET`, `APP_URL`, `DATABASE_URL`…) — в окружении команды.

`E2E_BASE_URL` можно не задавать — дефолт `http://localhost:3000`.
Для прогона на стейдже: `E2E_BASE_URL=https://<стейдж-домен> npx playwright test`
(миграции и `SEED_DEV=1`-seed должны быть применены там же).

## В CI

Джоб `db-tests` (`.github/workflows/ci.yml`) поднимает postgres-сервис,
применяет миграции + `SEED_DEV=1`-seed, гоняет интеграционные тесты
(`@tax/integration-tests`) и e2e (`E2E_WEBSERVER=1`, Playwright сам стартует web).

Отчёт по падению: `npx playwright show-report` (трейсы и скриншоты
собираются только для упавших тестов).

## Контракт data-testid (согласован с зонами вёрстки M1-3/M1-4/M1-6)

| testid | Где | Что |
|---|---|---|
| `refLinkUrl` | `/cabinet` | элемент с **полным URL** реф-ссылки текстом |
| `copyLinkBtn` | `/cabinet` | кнопка «Копировать» рядом со ссылкой |
| `startQuizBtn` | `/r/[token]` | кнопка «Просчитать возврат» — открывает шаг анкеты |
| `quizForm` | `/r/[token]` (шаг 2) | `<form>` анкеты; поля `name=` из `leadFormSchema`: `firstName`, `phone`, `salePriceRub`, `taxPaidRub`, чекбокс `consentPersonalData` — согласие ПДн 152-ФЗ (реальный кликабельный `<input type="checkbox">`) |
| `quizSubmit` | `/r/[token]` | кнопка отправки анкеты |
| `quizSuccess` | `/r/[token]` | блок «Заявка принята» после сабмита |
| `dealRow` | `/cabinet/deals` | строка/карточка заявки; содержит имя клиента и label статуса («Новая заявка») |

Страница невалидного/неизвестного/деактивированного токена: содержит слово
«недействительна» (любая словоформа) и **не** рендерит `quizForm`.
