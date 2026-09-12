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

CI содержит PostgreSQL/seed для отдельного integration suite и E2E на dev server; для анонимного smoke seed не требуется. Auth fixtures используют отдельную seed-free БД, как описано ниже. Browser smoke не доказывает отзыв старых сессий, закрытие legacy bot или защиту live. Прямые server actions/services проверяются `pnpm --filter @tax/web test`.

## Auth Credentials и production containment

Полный набор: `auth-credentials.spec.ts` выполняет настоящий CSRF → Credentials HTTP → Argon2 → Prisma вход, затем проверяет защищённые страницы и отзыв доступа после изменения своих синтетических строк. `session-containment.spec.ts` проверяет JWT generation, HTTP session update, malformed/wrong-key/expired cookies и реальный logout всех numeric chunks. JWT encode используется только для negative/characterization fixtures; успешный парольный вход получает cookie исключительно через HTTP.

Для auth suite обязательна **новая отдельная** локальная база `tax_b02a4_auth_e2e`, без seed. Не переиспользовать integration или рабочую БД. До fixtures требуется `E2E_SYNTHETIC_DB=1`; helper отвергает другой database, не-loopback app/DB и параметры переопределения соединения. Конфликт известного seed email завершает test ошибкой, не перезаписывает существующую строку. Fixtures имеют случайные IDs; finally удаляет только принадлежащие тесту User IDs с каскадом их профилей и закрывает клиент.

В обоих терминалах задайте одинаковые синтетические `DATABASE_URL`, `AUTH_SECRET` и `E2E_SYNTHETIC_AUTH_SECRET` (два secret значения должны совпадать), `AUTH_TRUST_HOST=true`, `E2E_SYNTHETIC_DB=1`, `APP_URL=http://localhost:3319`, `E2E_BASE_URL=http://localhost:3319`, `PORT=3319`. DATABASE_URL должен указывать на назначенный loopback PostgreSQL и точную auth DB. Next нормализует loopback IP в redirect URL к `localhost`, поэтому для этих тестов используйте единый canonical `localhost` origin; сервер при этом слушает только `127.0.0.1`.

```sh
unset E2E_WEBSERVER
pnpm db:deploy
pnpm build
pnpm --filter @tax/web start --hostname 127.0.0.1
```

Во втором терминале с тем же synthetic env:

```sh
unset E2E_WEBSERVER
pnpm e2e e2e/funnel.spec.ts e2e/session-containment.spec.ts e2e/auth-credentials.spec.ts
```

После проверки остановите только свои web/DB процессы. Не запускайте bot. Session API сам по себе не перечитывает статус пользователя из БД: drift проверяется защищённым запросом, который вызывает guard → session cleanup → login. Secure cookie cleanup проверяется raw HTTP Cookie/Set-Cookie и реальным Chromium через отдельный loopback HTTPS replay неизменённых заголовков production route. Replay создаёт временный self-signed сертификат через установленный `openssl`, затем закрывает TLS listener и удаляет временную папку в finally. Это тестовая инфраструктура, без нового application endpoint.

CI сохраняет отдельный integration/seed этап, затем создаёт новую auth E2E DB и применяет существующие миграции без seed. E2E step переключает DATABASE_URL и включает explicit synthetic opt-in. Existing CI launcher использует dev server; локальный release regression необходимо выполнять на `next start` после build. Ни локальный PASS, ни CI не являются проверкой live containment или разрешением deployment.
