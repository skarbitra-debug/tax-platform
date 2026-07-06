/**
 * Чистый расчёт распределения комиссии (§2 ТЗ). БЕЗ БД и без float:
 * вся арифметика в целых КОПЕЙКАХ и базисных пунктах (пункт = 0.01%),
 * поэтому CI-тестируется без DATABASE_URL. Persist-обёртка (persist.ts)
 * конвертирует Decimal(14,2)/Decimal(5,2) ↔ целые и пишет снапшот.
 *
 * Ставки НАСТРАИВАЕМЫЕ (§2): проценты и база расчёта приходят из
 * CommissionConfig, здесь ничего не захардкожено.
 */

/** База, от которой берутся проценты риэлтора/площадки/исполнителя (§2: параметр) */
export type CommissionBase = "REFUND_AMOUNT" | "CONSULTANT_FEE";

export type ExecutorInput =
  | { type: "FIXED"; fixedKopecks: number }
  | { type: "PERCENT"; rateBp: number };

export interface CommissionInput {
  /** фактически возвращённый налог, копейки (база гонорара клиента) */
  refundKopecks: number;
  /** ставка клиента, базисные пункты: 20.00% = 2000 */
  clientRateBp: number;
  realtorRateBp: number;
  platformRateBp: number;
  base: CommissionBase;
  executor: ExecutorInput;
}

export interface CommissionBreakdown {
  /** сумма, от которой считались доли (весь возврат или гонорар — по base) */
  baseKopecks: number;
  /** сколько платит клиент Татьяне = refund * clientRate */
  clientFeeKopecks: number;
  realtorKopecks: number;
  platformKopecks: number;
  executorKopecks: number;
  /** остаток Татьяне = clientFee − риэлтор − площадка − исполнитель (может быть < 0 при кривом конфиге) */
  consultantNetKopecks: number;
}

/**
 * Банковское округление (round-half-to-even) частного n/d для n≥0, d>0.
 * Только неотрицательные операнды: все округляемые произведения ≥ 0
 * (суммы и ставки неотрицательны), поэтому знак не усложняем.
 */
export function bankersRoundDiv(n: number, d: number): number {
  const q = Math.floor(n / d);
  const r = n - q * d;
  const twice = 2 * r;
  if (twice > d) return q + 1;
  if (twice < d) return q;
  // ровно половина → к чётному
  return q % 2 === 0 ? q : q + 1;
}

/** доля процента от суммы в копейках: amount * rateBp / 10000, банковское округление */
function pctOf(amountKopecks: number, rateBp: number): number {
  return bankersRoundDiv(amountKopecks * rateBp, 10_000);
}

/**
 * Инвариант результата: realtor + platform + executor + consultantNet === clientFee
 * (consultantNet определён как остаток — сходится копейка-в-копейку при любом округлении долей).
 */
export function computeCommission(input: CommissionInput): CommissionBreakdown {
  const clientFeeKopecks = pctOf(input.refundKopecks, input.clientRateBp);
  const baseKopecks =
    input.base === "REFUND_AMOUNT" ? input.refundKopecks : clientFeeKopecks;

  const realtorKopecks = pctOf(baseKopecks, input.realtorRateBp);
  const platformKopecks = pctOf(baseKopecks, input.platformRateBp);
  const executorKopecks =
    input.executor.type === "FIXED"
      ? input.executor.fixedKopecks
      : pctOf(baseKopecks, input.executor.rateBp);

  const consultantNetKopecks =
    clientFeeKopecks - realtorKopecks - platformKopecks - executorKopecks;

  return {
    baseKopecks,
    clientFeeKopecks,
    realtorKopecks,
    platformKopecks,
    executorKopecks,
    consultantNetKopecks,
  };
}
