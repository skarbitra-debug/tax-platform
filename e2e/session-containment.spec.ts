import { test, expect, type BrowserContext } from "@playwright/test";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const webRequire = createRequire(resolve("apps/web/package.json"));
const cookieName = "authjs.session-token";

async function putToken(context: BrowserContext, baseURL: string, claims: Record<string, unknown>, maxAge = 3600, wrongKey = false) {
  const secret = process.env.E2E_SYNTHETIC_AUTH_SECRET;
  if (!secret) throw new Error("Supply a dedicated synthetic E2E secret to the test and local web process");
  const { encode } = await import(pathToFileURL(webRequire.resolve("next-auth/jwt")).href);
  const value = await encode({ token: { id: "synthetic-user", sub: "synthetic-user", role: "ADMIN", realtorId: null, email: "operator.synthetic@example.test", ...claims }, secret: wrongKey ? `${secret}-wrong-key` : secret, salt: cookieName, maxAge });
  await context.addCookies([{ name: cookieName, value, url: baseURL, httpOnly: true, sameSite: "Lax" }]);
}

test.beforeEach(async ({ baseURL }) => {
  if (!baseURL || !["localhost", "127.0.0.1", "[::1]"].includes(new URL(baseURL).hostname)) throw new Error("Session E2E requires loopback baseURL");
});

test("legacy session API rejects a genuinely encrypted baseline JWT", async ({ context, baseURL }) => {
  await putToken(context, baseURL!, {});
  // page/context request shares the cookie jar; independent request fixture does not.
  const response = await context.request.get(`${baseURL}/api/auth/session`);
  expect(response.ok()).toBe(true);
  expect((await response.json())?.user).toBeFalsy();
});

test("legacy cookie reaches login from admin without redirect loops", async ({ context, page, baseURL }) => {
  await putToken(context, baseURL!, {});
  await page.goto("/login");
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
});

test("current allowed synthetic session survives real callbacks", async ({ context, baseURL }) => {
  await putToken(context, baseURL!, { sessionGeneration: 1 });
  const response = await context.request.get(`${baseURL}/api/auth/session`);
  expect((await response.json()).user).toMatchObject({ id: "synthetic-user", role: "ADMIN", sessionGeneration: 1 });
});

for (const email of ["admin@example.com", "realtor.dev@example.com"]) {
  test(`current seed identity is anonymous: ${email}`, async ({ context, baseURL }) => {
    await putToken(context, baseURL!, { sessionGeneration: 1, email });
    const response = await context.request.get(`${baseURL}/api/auth/session`);
    expect((await response.json())?.user).toBeFalsy();
  });
}

test("malformed cookie is anonymous", async ({ context, baseURL }) => {
  await context.addCookies([{ name: cookieName, value: "invalid-synthetic-signature", url: baseURL! }]);
  const response = await context.request.get(`${baseURL}/api/auth/session`);
  expect((await response.json())?.user).toBeFalsy();
});

test("cookie encrypted with a different synthetic key is anonymous", async ({ context, baseURL }) => {
  await putToken(context, baseURL!, { sessionGeneration: 1 }, 3600, true);
  const response = await context.request.get(`${baseURL}/api/auth/session`);
  expect((await response.json())?.user).toBeFalsy();
});

test("expired current generation is anonymous and cannot enter admin", async ({ context, page, baseURL }) => {
  await putToken(context, baseURL!, { sessionGeneration: 1 }, -60);
  const response = await context.request.get(`${baseURL}/api/auth/session`);
  expect((await response.json())?.user).toBeFalsy();
  await putToken(context, baseURL!, { sessionGeneration: 1 }, -60);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
});
