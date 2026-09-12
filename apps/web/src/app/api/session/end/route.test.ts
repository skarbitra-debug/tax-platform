import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ names: [] as string[], deleted: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({
  getAll: () => state.names.map((name) => ({ name, value: "synthetic-cookie" })),
  has: (name: string) => state.names.includes(name),
  delete: (name: string) => { state.deleted(name); state.names = state.names.filter((item) => item !== name); },
}) }));
vi.mock("next/server", () => ({ NextResponse: { redirect: (url: URL, options: { status: number }) => new Response(null, { status: options.status, headers: { location: url.href } }) } }));
import { GET } from "./route";
const authCookies = ["", ".0", ".1", ".2", ".10"].flatMap((suffix) => ["authjs.session-token" + suffix, "__Secure-authjs.session-token" + suffix]);
const unrelated = ["authjs.session-token.evil", "authjs.csrf-token", "authjs.session-token.1evil", "other", "prefix-authjs.session-token"];
beforeEach(() => { vi.clearAllMocks(); state.names = [...authCookies, ...unrelated]; });

describe("actual session-end route", () => {
  it("removes every numeric chunk and preserves unrelated cookies", async () => {
    const response = await GET(new Request("http://localhost/api/session/end?reason=blocked"));
    expect(state.names).toEqual(unrelated);
    expect(state.deleted).toHaveBeenCalledTimes(authCookies.length);
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost/login?error=blocked");
  });
  it.each(["https://evil.example", "blockedX", ""])("does not reflect arbitrary reason %s", async (reason) => {
    const response = await GET(new Request("http://localhost/api/session/end?reason=" + encodeURIComponent(reason)));
    expect(response.headers.get("location")).toBe("http://localhost/login");
  });
  it("is safe on repeated calls and an empty cookie store", async () => {
    state.names = [];
    await GET(new Request("http://localhost/api/session/end"));
    await GET(new Request("http://localhost/api/session/end"));
    expect(state.deleted).not.toHaveBeenCalled();
  });
});
