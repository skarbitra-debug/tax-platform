import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createLead } from "@tax/core";
import { prisma } from "@tax/db";
import { type TestRealtor, cleanupRealtor, createTestRealtor, leadInput } from "./helpers";

describe("createLead (воронка M1)", () => {
  let r: TestRealtor;
  beforeEach(async () => {
    r = await createTestRealtor();
  });
  afterEach(async () => {
    await cleanupRealtor(r);
  });

  it("создаёт Client + Deal + историю, атрибуцирует риэлтору, статус NEW", async () => {
    const res = await createLead(leadInput(r.token), { ip: "1.2.3.4", userAgent: "ua" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const deal = await prisma.deal.findUniqueOrThrow({
      where: { id: res.dealId },
      include: { status: true, statusHistory: true, client: true },
    });
    expect(deal.realtorId).toBe(r.realtorId); // атрибуция
    expect(deal.referralLinkId).toBe(r.linkId);
    expect(deal.status.code).toBe("NEW");
    expect(deal.consentIp).toBe("1.2.3.4");
    expect(deal.statusHistory).toHaveLength(1);
    expect(deal.statusHistory[0]!.fromStatusId).toBeNull();
    expect(deal.statusHistory[0]!.mode).toBe("AUTO");
    expect(deal.statusHistory[0]!.source).toBe("SYSTEM");
  });

  it("идемпотентность: тот же submissionId → одна сделка", async () => {
    const input = leadInput(r.token);
    const a = await createLead(input, {});
    const b = await createLead(input, {});
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) expect(a.dealId).toBe(b.dealId);
    const count = await prisma.deal.count({ where: { submissionId: input.submissionId } });
    expect(count).toBe(1);
  });

  it("тот же телефон второй раз → 2 сделки, второй помечен duplicateOfDealId", async () => {
    const phone = "+79995550001";
    const first = await createLead(leadInput(r.token, { phone }), {});
    const second = await createLead(leadInput(r.token, { phone }), {});
    expect(first.ok && second.ok).toBe(true);
    if (!second.ok || !first.ok) return;
    const deal2 = await prisma.deal.findUniqueOrThrow({ where: { id: second.dealId } });
    expect(deal2.duplicateOfDealId).toBe(first.dealId);
    // один Client на телефон (phone @unique)
    const clients = await prisma.client.count({ where: { phone } });
    expect(clients).toBe(1);
  });

  it("деактивированная ссылка → LINK_INACTIVE, ничего не создано", async () => {
    await prisma.referralLink.update({ where: { id: r.linkId }, data: { isActive: false } });
    const before = await prisma.deal.count({ where: { realtorId: r.realtorId } });
    const res = await createLead(leadInput(r.token), {});
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("LINK_INACTIVE");
    const after = await prisma.deal.count({ where: { realtorId: r.realtorId } });
    expect(after).toBe(before);
    await prisma.referralLink.update({ where: { id: r.linkId }, data: { isActive: true } });
  });

  it("несуществующий токен → LINK_NOT_FOUND", async () => {
    const res = await createLead(leadInput("zzzzzzzzzzzz"), {});
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("LINK_NOT_FOUND");
  });

  it("belowThreshold проставляется по активному конфигу", async () => {
    const cfg = await prisma.commissionConfig.findFirstOrThrow({ where: { isActive: true } });
    const threshold = cfg.minTaxThreshold ? cfg.minTaxThreshold.toNumber() : null;
    if (threshold === null) return; // порога нет — нечего проверять
    const low = await createLead(leadInput(r.token, { taxPaidRub: Math.max(1, threshold - 1) }), {});
    expect(low.ok).toBe(true);
    if (low.ok) {
      const deal = await prisma.deal.findUniqueOrThrow({ where: { id: low.dealId } });
      expect(deal.belowThreshold).toBe(true);
      expect(deal.consentRatePct.toNumber()).toBe(cfg.clientRatePct.toNumber()); // снапшот ставки
    }
  });
});
