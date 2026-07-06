import { test, expect, type Page } from "@playwright/test";

/**
 * Сквозной сценарий воронки (план M1-8, шаги 1–4 ТЗ §5):
 * логин риэлтора → реф-ссылка → инкогнито-анкета → заявка в ЛК + негатив.
 *
 * Требует: применённые миграции + seed с SEED_DEV=1 (тестовый риэлтор ниже),
 * запущенный web на E2E_BASE_URL — см. e2e/README.md.
 *
 * Контракт data-testid с зонами вёрстки (M1-3/M1-4/M1-6):
 *   refLinkUrl  — элемент с ПОЛНЫМ URL реф-ссылки (текстом) на /cabinet
 *   copyLinkBtn — кнопка «Копировать» рядом со ссылкой
 *   quizForm    — <form> анкеты на /r/[token]; поля с name= из leadFormSchema
 *                 (firstName, phone, salePriceRub, taxPaidRub + чекбоксы
 *                 consentNoUnderstatement, consentPaymentTerms — реальные
 *                 <input type="checkbox">, кликабельные)
 *   quizSubmit  — кнопка отправки анкеты
 *   quizSuccess — блок «Заявка принята» после сабмита
 *   dealRow     — строка/карточка заявки на /cabinet/deals; содержит имя
 *                 клиента и label статуса («Новая заявка»)
 * Страница невалидного/неизвестного токена: слово «недействительна»
 * (в любой словоформе) и НИКАКОЙ quizForm.
 */

// Dev-сид из M0 (packages/db/prisma/seed.ts, SEED_DEV=1)
const REALTOR_EMAIL = "realtor.dev@example.com";
const REALTOR_PASSWORD = "dev-realtor-123";

// Копия REFERRAL_TOKEN_REGEX из @tax/core (контракт §1): корневой e2e-пакет
// не тянет workspace-зависимости, поэтому regex продублирован дословно
const REF_URL_TOKEN_RE = /\/r\/([abcdefghjkmnpqrstuvwxyz23456789]{12})/;

// Уникальные данные клиента на каждый прогон — не упираемся в дедупликацию
// по телефону (duplicateOfDealId) от прошлых запусков на той же БД
const RUN_SUFFIX = Date.now().toString().slice(-9); // 9 цифр
const CLIENT_FIRST_NAME = `Тест-Е2Е ${RUN_SUFFIX}`;
const CLIENT_PHONE = `+79${RUN_SUFFIX}`; // +7 и ровно 10 цифр (normalizeRuPhone)

/** Логин риэлтора через форму /login (поля name= из login-form.tsx M0-8) */
async function loginAsRealtor(page: Page): Promise<void> {
  await page.goto("/login");
  await page.fill('input[name="email"]', REALTOR_EMAIL);
  await page.fill('input[name="password"]', REALTOR_PASSWORD);
  await page.getByRole("button", { name: "Войти" }).click();
  await page.waitForURL("**/cabinet"); // loginWithRedirect уводит домой по роли
}

test.describe("Воронка: ссылка → анкета → заявка (M1-8)", () => {
  test("happy path: реф-ссылка риэлтора приводит заявку в его ЛК", async ({
    page,
    browser,
    contextOptions,
  }) => {
    // ---------- (1) логин риэлтора ----------
    await loginAsRealtor(page);

    // ---------- (2) взять/создать реф-ссылку на /cabinet ----------
    // Блок M1-3 либо показывает существующую активную ссылку, либо создаёт
    // её (getOrCreateActiveReferralLink идемпотентен) — тесту без разницы
    const refLinkUrl = page.getByTestId("refLinkUrl");
    await expect(refLinkUrl).toBeVisible();
    await expect(page.getByTestId("copyLinkBtn")).toBeVisible();
    // Само копирование не проверяем: clipboard в headless-chromium нестабилен

    const linkText = (await refLinkUrl.textContent()) ?? "";
    const token = REF_URL_TOKEN_RE.exec(linkText)?.[1];
    expect(token, `в refLinkUrl нет токена формата §1: «${linkText}»`).toBeTruthy();

    // ---------- (3) клиент: инкогнито-контекст, анкета ----------
    // Свежий контекст = чужой браузер без куки риэлтора; contextOptions
    // наследует эмуляцию Pixel 7 из проекта (browser.newContext сам — нет)
    const clientContext = await browser.newContext(contextOptions);
    try {
      const clientPage = await clientContext.newPage();
      await clientPage.goto(`/r/${token}`);

      const quizForm = clientPage.getByTestId("quizForm");
      await expect(quizForm).toBeVisible();

      await quizForm.locator('input[name="firstName"]').fill(CLIENT_FIRST_NAME);
      await quizForm.locator('input[name="phone"]').fill(CLIENT_PHONE);
      // Валидные суммы по сценарию M1-8: живое форматирование разрядов
      // должно принимать «сырые» цифры (inputmode=numeric, план §4)
      await quizForm.locator('input[name="salePriceRub"]').fill("5000000");
      await quizForm.locator('input[name="taxPaidRub"]').fill("400000");
      await quizForm.locator('input[name="consentNoUnderstatement"]').check();
      await quizForm.locator('input[name="consentPaymentTerms"]').check();

      await clientPage.getByTestId("quizSubmit").click();
      await expect(clientPage.getByTestId("quizSuccess")).toBeVisible();
    } finally {
      await clientContext.close();
    }

    // ---------- (4) заявка видна риэлтору со статусом «Новая заявка» ----------
    await page.goto("/cabinet/deals");
    const newDealRow = page
      .getByTestId("dealRow")
      .filter({ hasText: CLIENT_FIRST_NAME });
    await expect(newDealRow).toHaveCount(1); // ровно одна — идемпотентность createLead
    await expect(newDealRow).toContainText("Новая заявка"); // label статуса NEW из seed
  });

  // ---------- (5) негатив: мусорный токен ----------
  test("мусорный токен: текст «недействительна», анкеты нет", async ({ page }) => {
    // Валидный ФОРМАТ (алфавит §1), но заведомо не существующий в БД токен —
    // проверяем ветку resolveReferralLink → not_found, а не только regex-отсев
    await page.goto("/r/zzzzzzzzzzzz");
    await expect(page.getByText(/недействительн/i).first()).toBeVisible();
    await expect(page.getByTestId("quizForm")).toHaveCount(0);
  });

  test("токен битого формата: анкеты нет", async ({ page }) => {
    // Не проходит REFERRAL_TOKEN_REGEX — отсев ещё до похода в БД (M1-4)
    await page.goto("/r/00-мусор-00");
    await expect(page.getByText(/недействительн/i).first()).toBeVisible();
    await expect(page.getByTestId("quizForm")).toHaveCount(0);
  });

  // Негатив «деактивированная ссылка» (DoD M1-8) требует UI деактивации
  // с согласованным testid (в контракте выше его пока нет) — включить,
  // когда зона M1-3 отдаст кнопку деактивации
  test.fixme(
    "деактивированная ссылка: «недействительна» без потери атрибуции",
    async () => {
      // План: логин → деактивировать ссылку → открыть /r/{token} инкогнито →
      // текст про недействительную ссылку, quizForm отсутствует →
      // создать новую ссылку → она работает
    },
  );
});
