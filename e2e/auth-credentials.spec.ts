import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { withAuthFixture, credentialsLogin, updateSession } from "./helpers/auth-fixtures";

async function session(context: BrowserContext, baseURL: string) {
  const response = await context.request.get(`${baseURL}/api/auth/session`);
  expect(response.ok()).toBe(true);
  return response.json();
}

async function expectLoggedOut(context: BrowserContext, page: Page, baseURL: string, path = "/admin") {
  await page.goto(path);
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
  expect((await session(context, baseURL))?.user).toBeFalsy();
  expect((await context.cookies()).filter(c => /^(?:__Secure-)?authjs\.session-token(?:\.\d+)?$/.test(c.name))).toEqual([]);
  await page.goto("/login");
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
}

// These catch broken password verification, missing generation stamping, and a
// false-positive session that cannot actually pass the database-backed guard.
for (const role of ["ADMIN", "REALTOR"] as const) {
  test(`real Credentials login opens ${role} protected page`, async ({ context, page, baseURL }) => {
    await withAuthFixture(baseURL, { role }, async ({ id, email, password, profileId }) => {
      const response = await credentialsLogin(context, baseURL!, email, password);
      expect(response.ok()).toBe(true);
      expect((await context.cookies()).some(c => c.name === "authjs.session-token")).toBe(true);
      expect((await session(context, baseURL!)).user).toMatchObject({ id, email, role, realtorId: profileId, sessionGeneration: 1 });
      const path = role === "ADMIN" ? "/admin" : "/cabinet";
      await page.goto(path);
      await expect(page).toHaveURL(`${baseURL}${path}`);
      await expect(page.locator("h1")).toBeVisible();
      await expect(page).not.toHaveTitle(/error|ошибка/i);
    });
  });
}

for (const scenario of ["wrong-password", "unknown-email", "PENDING", "BLOCKED", "admin@example.com", "realtor.dev@example.com"] as const) {
  test(`Credentials deny produces no session: ${scenario}`, async ({ context, page, baseURL }) => {
    await withAuthFixture(baseURL, {
      status: scenario === "PENDING" || scenario === "BLOCKED" ? scenario : "ACTIVE",
      ...(scenario.includes("@") ? { email: scenario } : {}),
    }, async ({ email, password }) => {
      const response = await credentialsLogin(context, baseURL!, scenario === "unknown-email" ? `missing-${email}` : email,
        scenario === "wrong-password" ? `${password}-wrong` : password);
      expect((await response.json()).url).toContain("error=CredentialsSignin");
      expect((await session(context, baseURL!))?.user).toBeFalsy();
      await expectLoggedOut(context, page, baseURL!);
    });
  });
}

// Each mutation breaks an independently enforced fresh-DB guard condition.
for (const drift of ["BLOCKED", "PENDING", "role", "profile-removed", "profile-rebound", "forbidden-email", "deleted"] as const) {
  test(`protected request revokes genuine login after DB ${drift} drift`, async ({ context, page, baseURL }) => {
    const role = drift.startsWith("profile") ? "REALTOR" : "ADMIN";
    await withAuthFixture(baseURL, { role }, async ({ db, id, email, password, profileId }) => {
      await credentialsLogin(context, baseURL!, email, password);
      expect((await session(context, baseURL!)).user.id).toBe(id);
      switch (drift) {
        case "BLOCKED": case "PENDING": await db.user.update({ where: { id }, data: { status: drift } }); break;
        case "role": await db.user.update({ where: { id }, data: { role: "REALTOR" } }); break;
        case "profile-removed": await db.realtorProfile.delete({ where: { id: profileId! } }); break;
        case "profile-rebound": await db.realtorProfile.update({ where: { id: profileId! }, data: { id: `${id}-replacement` } }); break;
        case "forbidden-email": await db.user.update({ where: { id }, data: { email: "admin@example.com" } }); break;
        case "deleted": await db.user.delete({ where: { id } }); break;
      }
      // Session endpoint is JWT-only. A protected request must trigger DB guard → cleanup.
      await expectLoggedOut(context, page, baseURL!, role === "ADMIN" ? "/admin" : "/cabinet");
    });
  });
}

test("HTTP session update cannot spoof identity, role, profile or generation", async ({ context, page, baseURL }) => {
  await withAuthFixture(baseURL, { role: "REALTOR" }, async ({ id, profileId, email, password }) => {
    await credentialsLogin(context, baseURL!, email, password);
    const claims = { id, email, role: "REALTOR", realtorId: profileId, sessionGeneration: 1 };
    expect((await session(context, baseURL!)).user).toMatchObject(claims);
    const forged = { id: "attacker", role: "ADMIN", realtorId: "another-profile", sessionGeneration: 2, email: "attacker@example.test" };
    const response = await updateSession(context, baseURL!, { ...forged, user: forged });
    expect(response.ok()).toBe(true);
    expect((await response.json()).user).toMatchObject(claims);
    expect((await session(context, baseURL!)).user).toMatchObject(claims);
    await page.goto("/admin");
    await expect(page).toHaveURL(`${baseURL}/cabinet`);
  });
});
