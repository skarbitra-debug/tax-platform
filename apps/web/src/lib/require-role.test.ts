import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), findUser: vi.fn(), writer: vi.fn() }));
class Redirect extends Error { constructor(public destination: string) { super(destination); } }
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@tax/db", () => ({ prisma: { user: { findUnique: mocks.findUser } } }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Redirect(url); } }));
import { requireRole } from "./require-role";
const user = { id: "synthetic-user", role: "ADMIN", realtorId: null, email: "operator.synthetic@example.test", sessionGeneration: 1 };
const dbUser = { role: "ADMIN", status: "ACTIVE", email: user.email, realtorProfile: null };
const blocked = "/api/session/end?reason=blocked";
async function action() { await requireRole("ADMIN"); mocks.writer(); }

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ user: { ...user } });
  mocks.findUser.mockResolvedValue({ ...dbUser });
});

describe("actual requireRole", () => {
  it("sends missing identity to login before DB", async () => {
    mocks.auth.mockResolvedValue({ user: {} });
    await expect(action()).rejects.toThrow("/login");
    expect(mocks.findUser).not.toHaveBeenCalled(); expect(mocks.writer).not.toHaveBeenCalled();
  });
  it.each([undefined, 0, 2, "1"])("revokes generation %s before DB", async (sessionGeneration) => {
    mocks.auth.mockResolvedValue({ user: { ...user, sessionGeneration } });
    await expect(action()).rejects.toThrow(blocked);
    expect(mocks.findUser).not.toHaveBeenCalled(); expect(mocks.writer).not.toHaveBeenCalled();
  });
  it.each([
    null, { status: "BLOCKED" }, { status: "PENDING" },
    { email: " ADMIN@EXAMPLE.COM " }, { email: "realtor.dev@example.com" },
    { role: "REALTOR", realtorProfile: { id: "synthetic-profile" } },
    { realtorProfile: { id: "unexpected-profile" } },
  ])("revokes invalid/current DB state %# before writer", async (change) => {
    mocks.findUser.mockResolvedValue(change === null ? null : { ...dbUser, ...change });
    await expect(action()).rejects.toThrow(blocked);
    expect(mocks.writer).not.toHaveBeenCalled();
  });
  it.each([null, { id: "changed-profile" }])("revokes missing/drifted REALTOR profile %#", async (realtorProfile) => {
    mocks.auth.mockResolvedValue({ user: { ...user, role: "REALTOR", realtorId: "synthetic-profile" } });
    mocks.findUser.mockResolvedValue({ ...dbUser, role: "REALTOR", realtorProfile });
    await expect(action()).rejects.toThrow(blocked);
    expect(mocks.writer).not.toHaveBeenCalled();
  });
  it("does not use cached session when DB fails", async () => {
    mocks.findUser.mockRejectedValue(new Error("synthetic database failure"));
    await expect(action()).rejects.toThrow("synthetic database failure");
    expect(mocks.writer).not.toHaveBeenCalled();
  });
  it("allows agreed ACTIVE ADMIN and returns checked identity", async () => {
    expect(await requireRole("ADMIN")).toEqual({ user });
    expect(mocks.findUser).toHaveBeenCalledWith({ where: { id: user.id }, select: { role: true, status: true, email: true, realtorProfile: { select: { id: true } } } });
    await action(); expect(mocks.writer).toHaveBeenCalledOnce();
  });
  it("allows agreed ACTIVE REALTOR and redirects only for a different requested role", async () => {
    const realtor = { ...user, role: "REALTOR", realtorId: "synthetic-profile" };
    mocks.auth.mockResolvedValue({ user: realtor });
    mocks.findUser.mockResolvedValue({ ...dbUser, role: "REALTOR", realtorProfile: { id: "synthetic-profile" } });
    expect(await requireRole("REALTOR")).toEqual({ user: realtor });
    await expect(action()).rejects.toThrow("/cabinet");
    expect(mocks.writer).not.toHaveBeenCalled();
  });
  it("redirects agreed ADMIN requesting REALTOR home without revoking", async () => {
    await expect(requireRole("REALTOR")).rejects.toThrow("/admin");
  });
});
