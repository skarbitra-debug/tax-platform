import { defineConfig, devices } from "@playwright/test";

/**
 * E2E-каркас (план M1-8): сквозной сценарий воронки на mobile viewport.
 *
 * Сервер НЕ поднимается конфигом (webServer сознательно отсутствует):
 * web запускают руками / CI-стадией ДО тестов — см. e2e/README.md.
 * Адрес приложения — через E2E_BASE_URL (стейдж/CI), дефолт — локальный dev.
 *
 * Тесты пишут в живую БД (создают Deal) — гонять только на dev/стейдже
 * с применёнными миграциями и seed'ом SEED_DEV=1 (тестовый риэлтор).
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },

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
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
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
