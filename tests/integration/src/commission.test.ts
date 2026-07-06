import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { computeCommission, createLead, recalcDealCommission } from "@tax/core";
import { Prisma, prisma } from "@tax/db";
import { type TestRealtor, cleanupRealtor, createTestRealtor, leadInput } from "./helpers";

describe("recalcDealCommission (M2)", () => {
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

  it("без возврата → NO_REFUND, снапшот не создаётся", async () => {
    const res = await recalcDealCommission(dealId);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("NO_REFUND");
    const c = await prisma.dealCommission.findUnique({ where: { dealId } });
    expect(c).toBeNull();
  });

  it("persist совпадает с чистым computeCommission по активному конфигу", async () => {
    const refundRub = 1_000_000;
    await prisma.deal.update({
      where: { id: dealId },
      data: { actualRefundAmount: new Prisma.Decimal(refundRub) },
    });
    const res = await recalcDealCommission(dealId);
    expect(res.ok).toBe(true);

    const cfg = await prisma.commissionConfig.findFirstOrThrow({ where: { isActive: true } });
    const expected = computeCommission({
      refundKopecks: refundRub * 100,
      clientRateBp: cfg.clientRatePct.toNumber() * 100,
      realtorRateBp: cfg.realtorRatePct.toNumber() * 100,
      platformRateBp: cfg.platformRatePct.toNumber() * 100,
      base: cfg.commissionBase,
      executor:
        cfg.executorPayoutType === "FIXED"
          ? { type: "FIXED", fixedKopecks: (cfg.executorFixedAmount?.toNumber() ?? 0) * 100 }
          : { type: "PERCENT", rateBp: (cfg.executorRatePct?.toNumber() ?? 0) * 100 },
    });

    const c = await prisma.dealCommission.findUniqueOrThrow({ where: { dealId } });
    expect(c.clientFeeAmount.toNumber() * 100).toBe(expected.clientFeeKopecks);
    expect(c.realtorAmount.toNumber() * 100).toBe(expected.realtorKopecks);
    expect(c.platformAmount.toNumber() * 100).toBe(expected.platformKopecks);
    expect(c.executorAmount.toNumber() * 100).toBe(expected.executorKopecks);
    expect(c.consultantNetAmount.toNumber() * 100).toBe(expected.consultantNetKopecks);
    expect(c.configId).toBe(cfg.id); // снапшот привязан к версии конфига
  });

  it("recalc идемпотентен: повтор не плодит снапшотов", async () => {
    await prisma.deal.update({
      where: { id: dealId },
      data: { actualRefundAmount: new Prisma.Decimal(500_000) },
    });
    await recalcDealCommission(dealId);
    await recalcDealCommission(dealId);
    const count = await prisma.dealCommission.count({ where: { dealId } });
    expect(count).toBe(1);
  });
});
