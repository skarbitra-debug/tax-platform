import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const effects = vi.hoisted(() => ({
  construct: vi.fn(), start: vi.fn(), command: vi.fn(), on: vi.fn(), catch: vi.fn(),
  count: vi.fn(), upsert: vi.fn(), userRead: vi.fn(), accountRead: vi.fn(),
  apply: vi.fn(), context: vi.fn(), parse: vi.fn(), fetch: vi.fn(), spawn: vi.fn(), pipeline: vi.fn(),
  reply: vi.fn(), getFile: vi.fn(), typing: vi.fn(),
  envRead: vi.fn(), voice: vi.fn(), createStt: vi.fn(), configured: vi.fn(),
}));
vi.mock("@tax/core", () => ({ applyVoiceCommand: effects.apply, buildVoiceContext: effects.context, parseVoiceCommand: effects.parse }));
vi.mock("node:child_process", () => ({ spawn: effects.spawn }));
vi.mock("@xenova/transformers", () => ({ pipeline: effects.pipeline, env: {} }));
vi.mock("grammy", () => ({ Bot: effects.construct }));
vi.mock("@tax/db", () => ({ prisma: {
  deal: { count: effects.count }, user: { findFirst: effects.userRead },
  telegramAccount: { upsert: effects.upsert, findFirst: effects.accountRead },
} }));
vi.mock("./env", () => ({ env: new Proxy({}, {
  get: (_target, key) => effects.envRead(key),
}) }));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  const environment: Record<string, string> = {
    TELEGRAM_BOT_TOKEN: "synthetic-token", TELEGRAM_ADMIN_CHAT_ID: "123", NODE_ENV: "test",
  };
  effects.envRead.mockImplementation((key: string) => environment[key]);
  effects.construct.mockImplementation(function () {
    return { start: effects.start, command: effects.command, on: effects.on, catch: effects.catch };
  });
  effects.start.mockResolvedValue(undefined);
  effects.userRead.mockResolvedValue({ id: "synthetic-admin" });
  effects.upsert.mockResolvedValue({ id: "synthetic-binding" });
  vi.stubGlobal("fetch", effects.fetch);
  effects.fetch.mockResolvedValue({ arrayBuffer: async () => new ArrayBuffer(3) });
  effects.getFile.mockResolvedValue({ file_path: "synthetic.ogg" });
  effects.spawn.mockImplementation(() => { throw new Error("child process must not start"); });
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function expectNoEffects() {
  for (const effect of Object.values(effects)) expect(effect).not.toHaveBeenCalled();
}

describe("disabled entrypoint", () => {
  beforeEach(() => {
    vi.doMock("./voice", () => ({ handleVoice: effects.voice }));
    vi.doMock("./stt", () => ({ createStt: effects.createStt, isSttConfigured: effects.configured }));
  });
  it.each(["configured", "missing"])("import with %s environment never starts polling or bootstrap", async (configuration) => {
    if (configuration === "missing") effects.envRead.mockReturnValue(undefined);
    await import("./index");
    await Promise.resolve();
    expectNoEffects();
    expect(console.info).toHaveBeenCalledExactlyOnceWith("Legacy bot disabled.");
  });
});

// Direct services are unmocked: shutting down index alone must not pass these tests.
describe.each(["configured", "missing"])("direct legacy services with %s environment", (configuration) => {
  beforeEach(() => {
    vi.doUnmock("./voice");
    vi.doUnmock("./stt");
    if (configuration === "missing") effects.envRead.mockReturnValue(undefined);
  });

  it("imports actual voice and STT without configuration or external effects", async () => {
    await import("./voice");
    await import("./stt");
    expectNoEffects();
  });

  it("refuses an administrator voice message without download, reply or mutation", async () => {
    const { handleVoice } = await import("./voice");
    const ctx = {
      chat: { id: 123 }, message: { voice: { file_id: "synthetic-file" }, message_id: 1 },
      reply: effects.reply, getFile: effects.getFile, replyWithChatAction: effects.typing,
    };
    await expect(handleVoice(ctx as unknown as import("grammy").Context)).rejects.toThrow("LEGACY_BOT_DISABLED");
    expectNoEffects();
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("refuses a hostile context before reading any property", async () => {
    const { handleVoice } = await import("./voice");
    const ctx = new Proxy({}, { get() { throw new Error("ctx must not be read"); } });
    await expect(handleVoice(ctx as import("grammy").Context)).rejects.toThrow("LEGACY_BOT_DISABLED");
    expectNoEffects();
  });

  it("reports STT unavailable", async () => {
    const { isSttConfigured } = await import("./stt");
    expect(isSttConfigured()).toBe(false);
    expectNoEffects();
  });

  it("creates an inert adapter without env, process or network effects", async () => {
    const { createStt } = await import("./stt");
    createStt();
    expectNoEffects();
  });

  it("rejects transcription, including repeats and concurrent calls, without starting a process/model", async () => {
    const { createStt } = await import("./stt");
    const stt = createStt();
    const bytes = new Uint8Array([1, 2, 3]);
    await expect(stt.transcribe(bytes)).rejects.toThrow("LEGACY_BOT_DISABLED");
    await expect(stt.transcribe(bytes)).rejects.toThrow("LEGACY_BOT_DISABLED");
    const results = await Promise.allSettled([stt.transcribe(bytes), stt.transcribe(bytes)]);
    for (const result of results) {
      expect(result.status).toBe("rejected");
      if (result.status === "rejected") expect(result.reason).toEqual(new Error("LEGACY_BOT_DISABLED"));
    }
    expectNoEffects();
  });
});
