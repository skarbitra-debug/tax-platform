import { beforeEach, describe, expect, it, vi } from "vitest";
import { ResponseCookies } from "next/dist/compiled/@edge-runtime/cookies";
const state = vi.hoisted(() => ({ names: [] as string[], headers: new Headers() }));
vi.mock("next/headers", () => ({ cookies: async () => {
  // Keep Next's real serialization: a name-only delete must not masquerade as
  // a valid __Secure- expiry. Only the request-local store adapter is replaced.
  const outgoing = new ResponseCookies(state.headers);
  return {
    getAll: () => state.names.map((name) => ({ name, value: "synthetic-cookie" })),
    delete: outgoing.delete.bind(outgoing),
    set: outgoing.set.bind(outgoing),
  };
} }));
import { GET } from "./route";
const authCookies = ["", ".0", ".1", ".2", ".10"].flatMap((suffix) => ["authjs.session-token" + suffix, "__Secure-authjs.session-token" + suffix]);
const unrelated = ["authjs.session-token.evil", "authjs.csrf-token", "authjs.session-token.1evil", "other", "prefix-authjs.session-token"];
beforeEach(() => { state.headers = new Headers(); state.names = [...authCookies, ...unrelated]; });

describe("actual session-end route", () => {
  it("expires every numeric chunk with prefix-valid attributes and preserves unrelated cookies", async () => {
    const response = await GET(new Request("https://localhost/api/session/end?reason=blocked"));
    const cookies = state.headers.getSetCookie();
    expect(cookies).toHaveLength(authCookies.length);
    for (const name of authCookies) {
      const cookie = cookies.find(value => value.startsWith(`${name}=`));
      expect(cookie).toBeDefined();
      expect(cookie).toMatch(/; Path=\/(?:;|$)/);
      expect(cookie).toMatch(/; Expires=Thu, 01 Jan 1970 00:00:00 GMT/);
      if (name.startsWith("__Secure-")) expect(cookie).toMatch(/; Secure(?:;|$)/);
    }
    for (const name of unrelated) expect(cookies.some(value => value.startsWith(`${name}=`))).toBe(false);
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://localhost/login?error=blocked");
  });
  it.each(["https://evil.example", "blockedX", ""])("does not reflect arbitrary reason %s", async (reason) => {
    const response = await GET(new Request("http://localhost/api/session/end?reason=" + encodeURIComponent(reason)));
    expect(response.headers.get("location")).toBe("http://localhost/login");
  });
  it("is safe on repeated calls and an empty cookie store", async () => {
    state.names = [];
    await GET(new Request("http://localhost/api/session/end"));
    await GET(new Request("http://localhost/api/session/end"));
    expect(state.headers.getSetCookie()).toEqual([]);
  });
});
