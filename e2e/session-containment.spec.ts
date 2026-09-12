import { test, expect, type BrowserContext } from "@playwright/test";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { createServer } from "node:https";

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
  expect((await context.cookies()).filter(c => c.name === cookieName)).toEqual([]);
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

for (const generation of [0, 2, "1", 1.5]) {
  test(`invalid generation ${JSON.stringify(generation)} is anonymous and cleared`, async ({ context, page, baseURL }) => {
    await putToken(context, baseURL!, { sessionGeneration: generation });
    const response = await context.request.get(`${baseURL}/api/auth/session`);
    expect(response.ok()).toBe(true);
    expect((await response.json())?.user).toBeFalsy();
    expect((await context.cookies()).filter(c => c.name === cookieName)).toEqual([]);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login(?:\?|$)/);
    await page.goto("/login");
    await expect(page).toHaveURL(/\/login(?:\?|$)/);
  });
}

for (const claims of [{}, { sessionGeneration: 0 }]) {
  test(`HTTP update cannot upgrade ${"sessionGeneration" in claims ? "stale" : "legacy"} token`, async ({ context, baseURL }) => {
    // Get CSRF before installing the revoked token: test POST itself performs rejection.
    const csrf = await context.request.get(`${baseURL}/api/auth/csrf`);
    const { csrfToken } = await csrf.json();
    await putToken(context, baseURL!, claims);
    const response = await context.request.post(`${baseURL}/api/auth/session`, {
      data: { csrfToken, data: { sessionGeneration: 1, user: { id: "synthetic-user", role: "ADMIN", sessionGeneration: 1 } } },
    });
    expect(response.ok()).toBe(true);
    expect((await response.json())?.user).toBeFalsy();
    expect((await context.cookies()).filter(c => c.name === cookieName)).toEqual([]);
  });
}

test("session cleanup expires every exact plain/secure numeric chunk and preserves lookalikes", async ({ context, baseURL }) => {
  const removed = ["authjs.session-token", "__Secure-authjs.session-token"].flatMap(prefix => [prefix, `${prefix}.0`, `${prefix}.2`, `${prefix}.10`]);
  const preserved = ["authjs.session-token-backup", "authjs.session-token.x", "__Secure-authjs.session-token.x", "authjs.csrf-token", "__Host-authjs.csrf-token"];
  // Raw HTTP header exercises Secure prefixes even on browsers that reject Secure loopback storage.
  const response = await context.request.get(`${baseURL}/api/session/end?reason=blocked&callbackUrl=https://example.test`, {
    headers: { Cookie: [...removed, ...preserved].map(name => `${name}=synthetic`).join("; ") }, maxRedirects: 0,
  });
  expect(response.status()).toBe(303);
  expect(response.headers().location).toBe(`${baseURL}/login?error=blocked`);
  const cookies = response.headersArray().filter(h => h.name.toLowerCase() === "set-cookie").map(h => h.value);
  for (const name of removed) {
    const cookie = cookies.find(value => value.startsWith(`${name}=`));
    expect(cookie, `expiry for ${name}`).toBeDefined();
    expect(cookie).toMatch(/(?:Max-Age=0|Expires=Thu, 01 Jan 1970)/i);
    expect(cookie).toMatch(/; Path=\/(?:;|$)/);
    if (name.startsWith("__Secure-")) expect(cookie).toMatch(/; Secure(?:;|$)/);
  }
  for (const name of preserved) expect(cookies.some(value => value.startsWith(`${name}=`))).toBe(false);
});


test("Chromium HTTPS applies actual cleanup headers to every secure/plain chunk", async ({ browser, context, baseURL }) => {
  const removed = ["authjs.session-token", "__Secure-authjs.session-token"].flatMap(prefix => [prefix, `${prefix}.0`, `${prefix}.2`, `${prefix}.10`]);
  const preserved = ["authjs.session-token.x", "__Secure-authjs.session-token.x", "authjs.csrf-token", "__Host-authjs.csrf-token"];
  const response = await context.request.get(`${baseURL}/api/session/end`, {
    headers: { Cookie: [...removed, ...preserved].map(name => `${name}=synthetic`).join("; ") }, maxRedirects: 0,
  });
  expect(response.status()).toBe(303);
  const actualHeaders = response.headersArray().filter(h => h.name.toLowerCase() === "set-cookie").map(h => h.value);
  const directory = mkdtempSync(resolve(tmpdir(), "auth-cookie-replay-"));
  const key = resolve(directory, "key.pem");
  const cert = resolve(directory, "cert.pem");
  let tls: ReturnType<typeof createServer> | undefined;
  const secureContext = await browser.newContext({ ignoreHTTPSErrors: true });
  try {
    execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", key, "-out", cert, "-days", "1", "-subj", "/CN=localhost"], { stdio: "ignore" });
    // A local TLS replay transports the *unmodified production route headers* to
    // Chromium. It is test infrastructure, not an added application endpoint.
    tls = createServer({ key: readFileSync(key), cert: readFileSync(cert) }, (request, reply) => {
      reply.setHeader("Content-Type", "text/html");
      if (request.url === "/seed") reply.setHeader("Set-Cookie", [...removed, ...preserved].map(name =>
        `${name}=synthetic; Path=/; HttpOnly; SameSite=Lax${name.startsWith("__Secure-") || name.startsWith("__Host-") ? "; Secure" : ""}`));
      if (request.url === "/cleanup") reply.setHeader("Set-Cookie", actualHeaders);
      reply.end("<html><body>Synthetic cookie transport</body></html>");
    });
    await new Promise<void>((resolveReady, reject) => {
      tls!.once("error", reject);
      tls!.listen(0, "127.0.0.1", resolveReady);
    });
    const address = tls.address();
    if (!address || typeof address === "string") throw new Error("Missing loopback TLS port");
    const origin = `https://localhost:${address.port}`;
    const page = await secureContext.newPage();
    await page.goto(`${origin}/seed`);
    expect((await secureContext.cookies()).map(c => c.name).sort()).toEqual([...removed, ...preserved].sort());
    await page.goto(`${origin}/cleanup`);
    expect((await secureContext.cookies()).map(c => c.name).sort()).toEqual([...preserved].sort());
  } finally {
    try { await secureContext.close(); }
    finally {
      try {
        if (tls?.listening) await new Promise<void>((resolveClosed, reject) => tls!.close(error => error ? reject(error) : resolveClosed()));
      } finally { rmSync(directory, { recursive: true, force: true }); }
    }
  }
});
