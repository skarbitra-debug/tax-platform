import { describe, expect, it } from "vitest";
import { isCurrentSessionGeneration, isForbiddenSeedIdentity } from "./session-policy";

describe("session generation", () => {
  it.each([undefined, null, "1", NaN, 0, 2, 1.5, Infinity, {}, true])("rejects non-current value %s", (value) => {
    expect(isCurrentSessionGeneration(value)).toBe(false);
  });
  it("accepts current numeric generation", () => expect(isCurrentSessionGeneration(1)).toBe(true));
});

describe("known seed identity boundary", () => {
  it.each(["realtor.dev@example.com", " ADMIN@EXAMPLE.COM ", " Realtor.Dev@Example.Com "])("denies normalized %s", (email) => {
    expect(isForbiddenSeedIdentity(email)).toBe(true);
  });
  it.each([null, undefined, 1, "", "operator.synthetic@example.test", "realtor.synthetic@example.test", "other@admin@example.com", "admin@example.com.evil"])("does not wildcard deny %s", (email) => {
    expect(isForbiddenSeedIdentity(email)).toBe(false);
  });
});
