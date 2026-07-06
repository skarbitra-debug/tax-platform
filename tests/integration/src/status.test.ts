import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { changeDealStatus, changeDealStatusByCode, createLead, listActiveStatuses } from "@tax/core";
import { prisma } from "@tax/db";
import { type TestRealtor, cleanupRealtor, createTestRealtor, leadInput } from "./helpers";

describe("движок статусов (M2, §6)", () => {
  let r: TestRealtor;
  let dealId: string;
  beforeEach(async () => {
    r = await createTestRealtor();
    const res = await createLead(leadInput(r.token), {});
    if (res.ok) dealId = res.dealId;
  });
  afterEach(async () => {
    await cleanupRealtor(r);
  });

  it("ручная смена статуса пишет историю (MANUAL/WEB)", async () => {
    const statuses = await listActiveStatuses();
    const target = statuses.find((s) => s.code === "CONTRACT_SENT")!;
    const res = await changeDealStatus({
      dealId,
      toStatusId: target.id,
      mode: "MANUAL",
      source: "WEB",
      comment: "тест",
    });
    expect(res.ok && res.changed).toBe(true);
    const deal = await prisma.deal.findUniqueOrThrow({ where: { id: dealId }, include: { status: true } });
    expect(deal.status.code).toBe("CONTRACT_SENT");
    const hist = await prisma.dealStatusHistory.findFirst({
      where: { dealId, toStatusId: target.id },
    });
    expect(hist?.mode).toBe("MANUAL");
    expect(hist?.comment).toBe("тест");
  });

  it("повтор того же статуса → changed=false, история не растёт", async () => {
    const statuses = await listActiveStatuses();
    const target = statuses.find((s) => s.code === "IN_PROGRESS")!;
    await changeDealStatus({ dealId, toStatusId: target.id, mode: "MANUAL", source: "WEB" });
    const before = await prisma.dealStatusHistory.count({ where: { dealId } });
    const again = await changeDealStatus({ dealId, toStatusId: target.id, mode: "MANUAL", source: "WEB" });
    const after = await prisma.dealStatusHistory.count({ where: { dealId } });
    expect(again.ok).toBe(true);
    if (again.ok) expect(again.changed).toBe(false);
    expect(after).toBe(before);
  });

  it("changeDealStatusByCode + несуществующий код → STATUS_NOT_FOUND", async () => {
    const ok = await changeDealStatusByCode({ dealId, toStatusCode: "FNS_REVIEW", mode: "AUTO", source: "SYSTEM" });
    expect(ok.ok).toBe(true);
    const bad = await changeDealStatusByCode({ dealId, toStatusCode: "NOPE", mode: "AUTO", source: "SYSTEM" });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.reason).toBe("STATUS_NOT_FOUND");
  });

  it("несуществующая сделка → DEAL_NOT_FOUND", async () => {
    const statuses = await listActiveStatuses();
    const res = await changeDealStatus({
      dealId: "nonexistent-id",
      toStatusId: statuses[0]!.id,
      mode: "MANUAL",
      source: "WEB",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("DEAL_NOT_FOUND");
  });
});
