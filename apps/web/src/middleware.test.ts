import { describe, expect, it, vi } from "vitest";
vi.mock("next-auth", () => ({ default: () => ({ auth: (handler: unknown) => handler }) }));
import middleware from "./middleware";
const run = middleware as unknown as (request: { nextUrl: URL; auth: unknown }) => Response | undefined;
const current = { id: "synthetic-user", role: "ADMIN", email: "operator.synthetic@example.test", sessionGeneration: 1 };
const request = (path: string, user: unknown) => run({ nextUrl: new URL(path, "http://localhost"), auth: user ? { user } : null });

describe("edge containment", () => {
  it.each([null, { ...current, sessionGeneration: undefined }, { ...current, sessionGeneration: 0 }, { ...current, email: " ADMIN@EXAMPLE.COM " }])("denies stale/seed identity %#", (user) => {
    for (const path of ["/admin", "/cabinet/deals?x=1"]) {
      const response = request(path, user);
      expect(response).toBeDefined();
      const destination = new URL(response!.headers.get("location")!);
      expect(destination.pathname).toBe("/login");
      expect(destination.searchParams.get("callbackUrl")).toBe(path);
    }
    expect(request("/login", user)).toBeUndefined();
  });
  it.each([
    ["ADMIN", "/admin", null], ["ADMIN", "/cabinet", "/admin"], ["ADMIN", "/login", "/admin"],
    ["REALTOR", "/cabinet", null], ["REALTOR", "/admin", "/cabinet"], ["REALTOR", "/login", "/cabinet"],
  ])("preserves %s routing at %s", (role, path, expected) => {
    const response = request(path!, { ...current, role });
    if (expected) expect(new URL(response!.headers.get("location")!).pathname).toBe(expected);
    else expect(response).toBeUndefined();
  });
});
