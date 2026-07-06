import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyVoiceCommand, createLead } from "@tax/core";
import { prisma } from "@tax/db";
import { type TestRealtor, cleanupRealtor, createTestRealtor, leadInput } from "./helpers";

describe("голосовой ассистент apply (M3, §4.7)", () => {
  let r: TestRealtor;
  let dealNumber: number;
  const meta = { chatId: 424242n, messageId: 1n, fileId: "f", telegramAccountId: null, actorUserId: null };

  beforeEach(async () => {
    r = await createTestRealtor();
    const res = await createLead(leadInput(r.token), {});
    if (res.ok) dealNumber = res.dealNumber;
  });
  afterEach(async () => {
    await prisma.voiceCommandLog.deleteMany({ where: { chatId: 424242n } });
    await cleanupRealtor(r);
  });

  it("применяет смену статуса, пишет лог APPLIED и трассировку в историю", async () => {
    const res = await applyVoiceCommand(
      { transcript: "договор отправлен", dealNumber, targetStatusCode: "CONTRACT_SENT", note: null },
      meta,
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const deal = await prisma.deal.findUniqueOrThrow({ where: { number: dealNumber }, include: { status: true } });
    expect(deal.status.code).toBe("CONTRACT_SENT");

    const log = await prisma.voiceCommandLog.findUniqueOrThrow({ where: { id: res.logId } });
    expect(log.status).toBe("APPLIED");
    expect(log.dealId).toBe(deal.id);

    const hist = await prisma.dealStatusHistory.findFirst({
      where: { dealId: deal.id, voiceCommandLogId: log.id, source: "TELEGRAM_VOICE" },
    });
    expect(hist).not.toBeNull();
  });

  it("несуществующая сделка → REJECTED", async () => {
    const res = await applyVoiceCommand(
      { transcript: "x", dealNumber: 999_999_999, targetStatusCode: "CLOSED", note: null },
      meta,
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("DEAL_NOT_FOUND");
    const log = await prisma.voiceCommandLog.findUniqueOrThrow({ where: { id: res.logId } });
    expect(log.status).toBe("REJECTED");
  });

  it("пустое намерение → NO_INTENT", async () => {
    const res = await applyVoiceCommand(
      { transcript: "непонятно", dealNumber: null, targetStatusCode: null, note: null },
      meta,
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("NO_INTENT");
  });
});
