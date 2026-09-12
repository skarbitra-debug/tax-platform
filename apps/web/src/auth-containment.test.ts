import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextAuthConfig } from "next-auth";

const mocks = vi.hoisted(() => ({
  findUser: vi.fn(), verify: vi.fn(), hash: vi.fn().mockResolvedValue("synthetic-dummy-hash"),
  authorize: undefined as undefined | ((credentials: Record<string, unknown>, request: Request) => unknown),
}));
vi.mock("@tax/db", () => ({ prisma: { user: { findUnique: mocks.findUser } } }));
vi.mock("@node-rs/argon2", () => ({ hash: mocks.hash, verify: mocks.verify }));
vi.mock("next-auth", () => ({ default: () => ({ handlers: {}, auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() }) }));
vi.mock("next-auth/providers/credentials", () => ({ default: (options: { authorize: typeof mocks.authorize }) => {
  mocks.authorize = options.authorize;
  return options;
} }));
import "./auth";
import { authConfig } from "./auth.config";

type Callbacks = NonNullable<NextAuthConfig["callbacks"]>;
const jwt: NonNullable<Callbacks["jwt"]> = authConfig.callbacks.jwt;
const session: NonNullable<Callbacks["session"]> = authConfig.callbacks.session;
const token = { id: "synthetic-user", email: "operator.synthetic@example.test", role: "ADMIN" as const, realtorId: null };
const callback = (args: Record<string, unknown>) => jwt(args as Parameters<typeof jwt>[0]);
const login = (email: string, extra = {}) => mocks.authorize!({ email, password: "synthetic-password", ...extra }, new Request("http://localhost/login"));

beforeEach(() => { vi.clearAllMocks(); mocks.verify.mockResolvedValue(true); });

describe("actual credentials authorize", () => {
  it.each(["realtor.dev@example.com", " ADMIN@EXAMPLE.COM ", " Realtor.Dev@Example.Com "])("denies known %s before DB and password verify", async (email) => {
    expect(await login(email)).toBeNull();
    expect(mocks.findUser).not.toHaveBeenCalled();
    expect(mocks.verify).not.toHaveBeenCalled();
  });
  it("allows an ACTIVE synthetic user and ignores caller role/generation", async () => {
    mocks.findUser.mockResolvedValue({ ...token, name: "Synthetic", status: "ACTIVE", passwordHash: "synthetic-hash", realtorProfile: null });
    expect(await login(" OPERATOR.SYNTHETIC@EXAMPLE.TEST ", { role: "REALTOR", sessionGeneration: 999 })).toEqual({ ...token, name: "Synthetic" });
    expect(mocks.findUser).toHaveBeenCalledWith(expect.objectContaining({ where: { email: token.email } }));
  });
  it.each(["BLOCKED", "PENDING"])("denies %s users", async (status) => {
    mocks.findUser.mockResolvedValue({ ...token, status, passwordHash: "synthetic-hash" });
    expect(await login(token.email)).toBeNull();
  });
  it("keeps dummy password verification for an unknown allowed email", async () => {
    mocks.findUser.mockResolvedValue(null);
    expect(await login(token.email)).toBeNull();
    expect(mocks.verify).toHaveBeenCalledWith("synthetic-dummy-hash", "synthetic-password");
  });
  it("denies a wrong password", async () => {
    mocks.findUser.mockResolvedValue({ ...token, status: "ACTIVE", passwordHash: "synthetic-hash" });
    mocks.verify.mockResolvedValue(false);
    expect(await login(token.email)).toBeNull();
  });
});

describe("real JWT/session callbacks", () => {
  it.each([undefined, 0, 2, "1", null])("rejects legacy/stale/malformed generation %s", async (sessionGeneration) => {
    expect(await callback({ token: { ...token, sessionGeneration } })).toBeNull();
  });
  it("does not upgrade legacy tokens through update payload", async () => {
    expect(await callback({ token: { ...token }, trigger: "update", session: { sessionGeneration: 1, user: { sessionGeneration: 1 } } })).toBeNull();
  });
  it("stamps generation only for a successful credentials signIn", async () => {
    expect(await callback({ token: { ...token }, trigger: "signIn", user: { ...token }, account: { provider: "credentials" } })).toEqual({ ...token, sessionGeneration: 1 });
  });
  it.each([
    { trigger: "update", account: { provider: "credentials" } },
    { trigger: "signIn", account: { provider: "other" } },
    { trigger: undefined, account: { provider: "credentials" } },
  ])("does not stamp outside trusted credentials signIn %#", async (extra) => {
    expect(await callback({ token: { ...token }, user: { ...token }, ...extra })).toBeNull();
  });
  it.each([{ id: "" }, { role: "OWNER" }, { email: " admin@example.com " }])("rejects invalid login user %#", async (override) => {
    expect(await callback({ token: { ...token }, trigger: "signIn", account: { provider: "credentials" }, user: { ...token, ...override } })).toBeNull();
  });
  it("preserves a current allowed token and ignores update data", async () => {
    const current = { ...token, sessionGeneration: 1 };
    expect(await callback({ token: current, trigger: "update", session: { role: "REALTOR", sessionGeneration: 999 } })).toEqual(current);
  });
  it("rejects a current known seed token", async () => {
    expect(await callback({ token: { ...token, email: "ADMIN@EXAMPLE.COM", sessionGeneration: 1 } })).toBeNull();
  });
  it("propagates checked generation to session", async () => {
    const result = await session({ session: { user: {}, expires: "2099-01-01" }, token: { ...token, sessionGeneration: 1 } } as Parameters<typeof session>[0]);
    expect(result.user).toMatchObject({ id: token.id, role: "ADMIN", realtorId: null, sessionGeneration: 1 });
  });
});
