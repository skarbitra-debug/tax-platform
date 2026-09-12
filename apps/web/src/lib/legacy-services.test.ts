import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const effects = vi.hoisted(() => ({
  credentialRead: vi.fn(), credentialWrite: vi.fn(), credentialDelete: vi.fn(), audit: vi.fn(),
  dealRead: vi.fn(), dealWrite: vi.fn(), decrypt: vi.fn(), encrypt: vi.fn(), key: vi.fn(),
  env: vi.fn(), format: vi.fn(), fetch: vi.fn(),
}));
vi.mock("@tax/db", () => ({ prisma: {
  fnsCredential: { findUnique: effects.credentialRead, upsert: effects.credentialWrite, deleteMany: effects.credentialDelete },
  auditLog: { create: effects.audit }, deal: { findUnique: effects.dealRead, update: effects.dealWrite },
} }));
vi.mock("@tax/crypto", () => ({
  decryptField: effects.decrypt, encryptField: effects.encrypt, keyFromEnv: effects.key,
  DecryptionFailedError: class DecryptionFailedError extends Error {},
}));
vi.mock("@tax/core", () => ({ formatHandoffMessage: effects.format }));
vi.mock("./env", () => ({ env: effects.env }));

import { isFnsStorageConfigured, hasFnsCredential, setFnsCredential, revealFnsCredential, clearFnsCredential } from "./fns";
import { sendHandoffToChannel } from "./telegram";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", effects.fetch);
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  effects.env.mockReturnValue({ FNS_ENCRYPTION_KEY: "synthetic-key", TELEGRAM_BOT_TOKEN: "synthetic-token", TELEGRAM_CHANNEL_ID: "synthetic-channel" });
  effects.credentialRead.mockResolvedValue({ id: "synthetic-credential", loginCiphertext: new Uint8Array([1]), loginNonce: new Uint8Array([2]), passwordCiphertext: new Uint8Array([3]), passwordNonce: new Uint8Array([4]) });
  effects.key.mockReturnValue(Buffer.alloc(32));
  effects.encrypt.mockReturnValue({ ciphertext: Buffer.alloc(16), nonce: Buffer.alloc(12) });
  effects.decrypt.mockReturnValue("synthetic-password");
  effects.dealRead.mockResolvedValue({ number: 1, taxPaidAmount: "300000", belowThreshold: false, client: { firstName: "Synthetic", phone: "+79990000001", telegramUsername: null } });
  effects.fetch.mockResolvedValue({ ok: true });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function expectNoEffects() {
  for (const effect of Object.values(effects)) expect(effect).not.toHaveBeenCalled();
  expect(console.error).not.toHaveBeenCalled();
  expect(console.warn).not.toHaveBeenCalled();
}

// A reintroduced DB/crypto/env/network operation must fail even if the outward refusal stays unchanged.
describe.each(["configured", "missing"])("disabled legacy services with %s configuration", (configuration) => {
  beforeEach(() => { if (configuration === "missing") effects.env.mockReturnValue({}); });
  it("reports no FNS storage without consulting env", () => {
    expect(isFnsStorageConfigured()).toBe(false);
    expectNoEffects();
  });
  it("reports no credentials without looking up the client", async () => {
    expect(await hasFnsCredential("synthetic-client")).toBe(false);
    expectNoEffects();
  });
  it("refuses storing credentials before key lookup/encryption/writes", async () => {
    await expect(setFnsCredential({ clientId: "synthetic-client", login: "synthetic-login", password: "synthetic-password", actorUserId: "synthetic-admin" })).rejects.toThrow("FNS_ACCESS_DISABLED");
    expectNoEffects();
  });
  it("refuses revealing credentials without reading/decrypting/auditing", async () => {
    const result = await revealFnsCredential({ clientId: "synthetic-client", actorUserId: "synthetic-admin", ip: "127.0.0.1" });
    expect(result).toEqual({ ok: false, reason: "DISABLED" });
    for (const secret of ["synthetic-login", "synthetic-password", "+79990000001"]) expect(JSON.stringify(result)).not.toContain(secret);
    expectNoEffects();
  });
  it("refuses clearing credentials without deleting/auditing", async () => {
    await expect(clearFnsCredential("synthetic-client", "synthetic-admin")).rejects.toThrow("FNS_ACCESS_DISABLED");
    expectNoEffects();
  });
  it("refuses repeated sends without reading PII or calling the network", async () => {
    expect(await sendHandoffToChannel("synthetic-deal")).toBe(false);
    expect(await sendHandoffToChannel("synthetic-deal")).toBe(false);
    expectNoEffects();
  });
});
