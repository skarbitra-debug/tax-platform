import { Prisma, prisma } from "@tax/db";
import { type CommissionBreakdown, computeCommission } from "./compute";

/** Decimal(14,2) рубли → целые копейки (округление до копейки на всякий) */
function toKopecks(d: Prisma.Decimal): number {
  return Math.round(d.times(100).toNumber());
}

/** Decimal(5,2) процент → базисные пункты (20.00 → 2000) */
function toBp(d: Prisma.Decimal): number {
  return Math.round(d.times(100).toNumber());
}

/** целые копейки → Decimal(14,2) рубли для записи в БД */
function kopecksToDecimal(kopecks: number): Prisma.Decimal {
  return new Prisma.Decimal(kopecks).div(100);
}

export type RecalcResult =
  | { ok: true; breakdown: CommissionBreakdown }
  | { ok: false; reason: "NO_REFUND" | "NO_CONFIG" | "DEAL_NOT_FOUND" };

/**
 * Пересчёт и сохранение снапшота DealCommission по фактическому возврату (§2).
 * Вызывается, когда админ проставил/изменил Deal.actualRefundAmount.
 *
 * Снапшот привязан к версии конфига (configId): последующая смена ставок НЕ
 * переписывает уже посчитанные сделки (план §1). Идемпотентно: upsert по dealId.
 * Возврат не задан → снапшот НЕ создаём (считать не от чего).
 */
export async function recalcDealCommission(dealId: string): Promise<RecalcResult> {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: { id: true, actualRefundAmount: true },
  });
  if (!deal) return { ok: false, reason: "DEAL_NOT_FOUND" };
  if (deal.actualRefundAmount === null) return { ok: false, reason: "NO_REFUND" };

  const cfg = await prisma.commissionConfig.findFirst({
    where: { isActive: true },
    orderBy: { effectiveFrom: "desc" },
  });
  if (!cfg) return { ok: false, reason: "NO_CONFIG" };

  const breakdown = computeCommission({
    refundKopecks: toKopecks(deal.actualRefundAmount),
    clientRateBp: toBp(cfg.clientRatePct),
    realtorRateBp: toBp(cfg.realtorRatePct),
    platformRateBp: toBp(cfg.platformRatePct),
    base: cfg.commissionBase,
    executor:
      cfg.executorPayoutType === "FIXED"
        ? { type: "FIXED", fixedKopecks: toKopecks(cfg.executorFixedAmount ?? new Prisma.Decimal(0)) }
        : { type: "PERCENT", rateBp: toBp(cfg.executorRatePct ?? new Prisma.Decimal(0)) },
  });

  const data = {
    configId: cfg.id,
    baseAmount: kopecksToDecimal(breakdown.baseKopecks),
    clientFeeAmount: kopecksToDecimal(breakdown.clientFeeKopecks),
    realtorAmount: kopecksToDecimal(breakdown.realtorKopecks),
    platformAmount: kopecksToDecimal(breakdown.platformKopecks),
    executorAmount: kopecksToDecimal(breakdown.executorKopecks),
    consultantNetAmount: kopecksToDecimal(breakdown.consultantNetKopecks),
  };

  await prisma.dealCommission.upsert({
    where: { dealId },
    create: { dealId, ...data },
    update: data,
  });

  return { ok: true, breakdown };
}
