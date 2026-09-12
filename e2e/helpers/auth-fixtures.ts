import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import type { BrowserContext } from "@playwright/test";
import { PrismaClient, type UserRole, type UserStatus } from "../../packages/db/src/index";

const webRequire = createRequire(resolve("apps/web/package.json"));
const { hash } = webRequire("@node-rs/argon2") as typeof import("../../apps/web/node_modules/@node-rs/argon2");
const loopback = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function assertSyntheticTarget(baseURL: string | undefined) {
  if (process.env.E2E_SYNTHETIC_DB !== "1") throw new Error("Auth fixtures require E2E_SYNTHETIC_DB=1");
  const app = new URL(baseURL ?? "invalid:");
  const db = new URL(process.env.DATABASE_URL ?? "invalid:");
  if (!loopback.has(app.hostname) || !["http:", "https:"].includes(app.protocol) ||
      !loopback.has(db.hostname) || !["postgres:", "postgresql:"].includes(db.protocol) ||
      db.pathname !== "/tax_b02a4_auth_e2e" || db.search || db.hash) {
    throw new Error("Auth fixtures require loopback app and exact dedicated tax_b02a4_auth_e2e database without connection overrides");
  }
}

export async function withAuthFixture<T>(
  baseURL: string | undefined,
  options: { role?: UserRole; status?: UserStatus; email?: string },
  run: (fixture: { db: PrismaClient; id: string; profileId: string | null; email: string; password: string }) => Promise<T>,
): Promise<T> {
  // Guard before constructing our client, hashing, or querying/mutating any row.
  assertSyntheticTarget(baseURL);
  const id = `b02a4-${randomUUID()}`;
  const email = options.email ?? `${id}@example.test`;
  if (!email.endsWith("@example.test") && !["admin@example.com", "realtor.dev@example.com"].includes(email)) {
    throw new Error("Auth fixtures only accept synthetic or explicitly forbidden seed identities");
  }
  const role = options.role ?? "ADMIN";
  const profileId = role === "REALTOR" ? `${id}-profile` : null;
  const password = `Synthetic-${randomUUID()}`;
  const db = new PrismaClient();
  let created = false;
  try {
    // Unique email conflict fails create: never overwrite or reuse another row.
    await db.user.create({ data: { id, email, passwordHash: await hash(password), role,
      status: options.status ?? "ACTIVE", name: "Synthetic auth fixture",
      ...(profileId ? { realtorProfile: { create: { id: profileId } } } : {}),
    } });
    created = true;
    return await run({ db, id, profileId, email, password });
  } finally {
    try {
      if (created) await db.user.deleteMany({ where: { id } });
    } finally { await db.$disconnect(); }
  }
}

export async function credentialsLogin(context: BrowserContext, baseURL: string, email: string, password: string) {
  const csrf = await context.request.get(`${baseURL}/api/auth/csrf`);
  if (!csrf.ok()) throw new Error(`CSRF endpoint failed: ${csrf.status()}`);
  const { csrfToken } = await csrf.json();
  if (typeof csrfToken !== "string" || !csrfToken) throw new Error("Missing actual CSRF token");
  return context.request.post(`${baseURL}/api/auth/callback/credentials`, {
    form: { csrfToken, email, password, callbackUrl: `${baseURL}/login` },
    headers: { "X-Auth-Return-Redirect": "1" },
    maxRedirects: 0,
  });
}

export async function updateSession(context: BrowserContext, baseURL: string, data: Record<string, unknown>) {
  const csrf = await context.request.get(`${baseURL}/api/auth/csrf`);
  const { csrfToken } = await csrf.json();
  if (!csrf.ok() || typeof csrfToken !== "string" || !csrfToken) throw new Error("Missing actual CSRF token");
  return context.request.post(`${baseURL}/api/auth/session`, { data: { csrfToken, data } });
}
