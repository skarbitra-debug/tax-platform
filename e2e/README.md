# Локальная E2E-проверка остановки legacy приёма

`funnel.spec.ts` проверяет анонимные `/r/abcdefgh2345`, `/r/00-invalid` и `/register`: нейтральные сообщения об остановке, отсутствие форм и полей ПД. Старый happy path заменён новым контрактом; старый fixme про деактивацию ссылки не применим к безусловно закрытому экрану.

Нужны Node 22+, pnpm и Chromium: `pnpm exec playwright install chromium`.
Синтетическая локальная конфигурация runtime задаётся в окружении, без production `.env`. Установить зависимости и сгенерировать Prisma Client:

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm db:generate
```

Для этих страниц не нужны PostgreSQL server, миграции, seed, dev-вход и Telegram credentials. Если Prisma generate требует DATABASE_URL, задать синтетический loopback URL; он не должен указывать на production.

Запускать только web, в отдельном терминале:

```sh
unset E2E_WEBSERVER
PORT=3319 pnpm --filter @tax/web dev --hostname 127.0.0.1
```

Во втором терминале:

```sh
unset E2E_WEBSERVER
E2E_BASE_URL=http://127.0.0.1:3319 pnpm e2e e2e/funnel.spec.ts
```

Остановить web после проверки. `pnpm dev` запускает также bot и здесь не подходит. Значение `E2E_WEBSERVER=0` в исходном конфиге truthy: переменную нужно удалить, а не присваивать 0. Тест отказывается открывать не-loopback baseURL.

Текущий CI всё ещё содержит PostgreSQL/seed для отдельного integration suite и E2E на dev server. Изменение CI относится к B02a; для этого анонимного smoke seed не требуется. Browser smoke не доказывает отзыв старых сессий, закрытие legacy bot или защиту live. Прямые server actions/services проверяются `pnpm --filter @tax/web test`.
