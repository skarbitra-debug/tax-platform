import { prisma } from "@tax/db";

/** Срез активного конфига для клиентской воронки: ставка в галке №4 + порог 250к */
export type ActiveCommissionConfig = {
  clientRatePct: number;
  minTaxThreshold: number | null;
};

/**
 * Активный конфиг комиссий (ровно один — partial-unique индекс
 * CommissionConfig на isActive=true из init-миграции; orderBy — страховка
 * на случай ручного вмешательства в БД). Decimal → number: ставка ≤ 100.00
 * и порог в рублях укладываются в double без потерь.
 *
 * Используется страницей /r/[token] для РЕНДЕРА условий (ставка из конфига,
 * не хардкод — §4 плана). Снапшоты в момент сабмита createLead делает сам,
 * своим чтением внутри транзакции.
 */
export async function getActiveCommissionConfig(): Promise<ActiveCommissionConfig> {
  const config = await prisma.commissionConfig.findFirst({
    where: { isActive: true },
    orderBy: { effectiveFrom: "desc" },
    select: { clientRatePct: true, minTaxThreshold: true },
  });
  if (!config) {
    // На развёрнутой системе невозможно: конфиг "default" создаёт seed (§2 п.3)
    throw new Error("Активный конфиг комиссий не найден — выполните seed.");
  }
  return {
    clientRatePct: config.clientRatePct.toNumber(),
    minTaxThreshold: config.minTaxThreshold ? config.minTaxThreshold.toNumber() : null,
  };
}
