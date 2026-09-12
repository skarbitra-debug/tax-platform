import { beforeEach, describe, expect, it, vi } from "vitest";

const effects = vi.hoisted(() => ({
  createLead: vi.fn(), after: vi.fn(), meta: vi.fn(), rateLimit: vi.fn(),
  hash: vi.fn(), transaction: vi.fn(), userRead: vi.fn(),
  signIn: vi.fn(), signOut: vi.fn(), redirect: vi.fn(),
  send: vi.fn(), revalidate: vi.fn(),
}));
// Replace external writers/framework context; invoke the actual action exports.
vi.mock("@tax/core", () => ({
  createLead: effects.createLead,
  leadFormSchema: { safeParse: (data: unknown) => ({ success: true, data }) },
  normalizeRuPhone: () => "+79990000001",
}));
vi.mock("@tax/db", () => ({ prisma: {
  $transaction: effects.transaction, user: { findUnique: effects.userRead },
} }));
vi.mock("next-auth", () => ({ AuthError: class AuthError extends Error {} }));
vi.mock("@/auth", () => ({ signIn: effects.signIn, signOut: effects.signOut }));
vi.mock("@node-rs/argon2", () => ({ hash: effects.hash }));
vi.mock("next/navigation", () => ({ redirect: effects.redirect }));
vi.mock("next/server", () => ({ after: effects.after }));
vi.mock("next/cache", () => ({ revalidatePath: effects.revalidate }));
vi.mock("@/lib/request-meta", () => ({ getRequestMeta: effects.meta }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: effects.rateLimit }));
vi.mock("@/lib/telegram", () => ({ sendHandoffToChannel: effects.send }));

import { submitApplication } from "./deal.actions";
import { registerRealtor } from "./auth.actions";

beforeEach(() => {
  vi.clearAllMocks();
  effects.meta.mockResolvedValue({ ip: "127.0.0.1" });
  effects.rateLimit.mockReturnValue(true);
  effects.createLead.mockResolvedValue({ ok: true, created: true, dealId: "synthetic-deal" });
  effects.transaction.mockResolvedValue({ ok: false, error: "legacy writer reached" });
});

function form(kind: "valid" | "empty" | "unreadable") {
  const data = new FormData();
  if (kind === "valid") {
    for (const [key, value] of Object.entries({
      token: "abcdefgh2345", submissionId: "123e4567-e89b-42d3-a456-426614174000",
      firstName: "Synthetic", phone: "+79990000001", salePriceRub: "10000000",
      taxPaidRub: "300000", consentPersonalData: "on", name: "Synthetic",
      email: "synthetic@example.test", password: "synthetic-password", inviteCode: "synthetic-invite",
    })) data.set(key, value);
  }
  const get = vi.spyOn(data, "get");
  if (kind === "unreadable") get.mockImplementation(() => { throw new Error("input must not be read"); });
  return { data, get };
}

const publicActions = [
  { name: "submitApplication", call: (data: FormData) => submitApplication({ ok: false }, data),
    response: { ok: false, formError: "Приём заявок временно недоступен." } },
  { name: "registerRealtor", call: (data: FormData) => registerRealtor({}, data),
    response: { error: "Регистрация временно недоступна." } },
];

for (const action of publicActions) {
  describe(action.name, () => {
    it.each(["valid", "empty", "unreadable"] as const)("denies %s input before reading or executing effects", async (kind) => {
      const { data, get } = form(kind);
      expect(await action.call(data)).toEqual(action.response);
      expect(get).not.toHaveBeenCalled();
      for (const effect of Object.values(effects)) expect(effect).not.toHaveBeenCalled();
    });
    it("denies repeated and concurrent calls without effects", async () => {
      const { data, get } = form("valid");
      expect(await action.call(data)).toEqual(action.response);
      expect(await action.call(data)).toEqual(action.response);
      expect(await Promise.all([action.call(data), action.call(data)])).toEqual([action.response, action.response]);
      expect(get).not.toHaveBeenCalled();
      for (const effect of Object.values(effects)) expect(effect).not.toHaveBeenCalled();
    });
  });
}
