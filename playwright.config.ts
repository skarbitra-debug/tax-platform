import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const port = new URL(baseURL).port || "3000";

/**
 * E2E-каркас (план M1-8): сквозной сценарий воронки на mobile viewport.
 *
 * По умолчанию сервер НЕ поднимается конфигом: web запускают руками
 * (локально) — см. e2e/README.md. В CI (E2E_WEBSERVER=1) Playwright сам
 * стартует dev-сервер на :3000 с env из джоба.
 * Адрес приложения — через E2E_BASE_URL (стейдж/CI), дефолт — локальный dev.
 *
 * Тесты пишут в живую БД (создают Deal) — гонять только на dev/стейдже
 * с применёнными миграциями и seed'ом SEED_DEV=1 (тестовый риэлтор).
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },

  // В CI поднимаем dev-сервер сами (env приходит из джоба); локально — вручную.
  // Порт берётся из E2E_BASE_URL (Next читает PORT) — можно указать свободный.
  webServer: process.env.E2E_WEBSERVER
    ? {
        command: "pnpm --filter @tax/web dev",
        url: baseURL,
        env: { PORT: port },
        reuseExistingServer: false,
        timeout: 120_000,
      }
    : undefined,

  // Сценарий последовательный (логин → ссылка → анкета → проверка в ЛК)
  // и делит одну БД — параллелизм тут только источник флаков
  fullyParallel: false,
  workers: 1,

  forbidOnly: !!process.env.CI, // забытый test.only не пройдёт CI
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never" }]]
    : [["list"]],

  use: {
    baseURL,
    locale: "ru-RU",
    timezoneId: "Europe/Moscow",
    // Артефакты только по падениям — трейс достаточен для разбора
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  // Только chromium с мобильной эмуляцией: анкета открывается из
  // Telegram-WebView на телефоне — это и есть целевой форм-фактор (план §4)
  projects: [
    {
      name: "chromium-mobile",
      use: { ...devices["Pixel 7"] },
    },
  ],
});
