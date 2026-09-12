import { test, expect } from "@playwright/test";

// This anonymous smoke must never target a deployed environment.
test.beforeEach(async ({ baseURL }) => {
  if (!baseURL || !["localhost", "127.0.0.1", "[::1]"].includes(new URL(baseURL).hostname)) {
    throw new Error("Containment E2E requires a loopback baseURL");
  }
});

for (const token of ["abcdefgh2345", "00-invalid"]) {
  test(`legacy intake is closed for ${token}`, async ({ page }) => {
    await page.goto(`/r/${token}`);
    await expect(page.getByText("Приём заявок временно недоступен.", { exact: true })).toBeVisible();
    for (const testId of ["quizForm", "quizSuccess", "startQuizBtn"]) {
      await expect(page.getByTestId(testId)).toHaveCount(0);
    }
    await expect(page.locator('input[name="phone"]')).toHaveCount(0);
  });
}

test("registration is closed without collecting personal data", async ({ page }) => {
  await page.goto("/register");
  await expect(page.getByText("Регистрация временно недоступна.", { exact: true })).toBeVisible();
  await expect(page.locator("form")).toHaveCount(0);
  await expect(page.locator("input")).toHaveCount(0);
});
