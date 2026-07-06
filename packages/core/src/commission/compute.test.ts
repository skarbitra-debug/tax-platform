import { describe, expect, it } from "vitest";
import { bankersRoundDiv, computeCommission } from "./compute";

describe("bankersRoundDiv (round-half-to-even)", () => {
  it("округляет не-половины обычным образом", () => {
    expect(bankersRoundDiv(10, 3)).toBe(3); // 3.33 → 3
    expect(bankersRoundDiv(11, 3)).toBe(4); // 3.66 → 4
    expect(bankersRoundDiv(0, 10000)).toBe(0);
  });

  it("ровно половину гонит к ЧЁТНОМУ", () => {
    expect(bankersRoundDiv(5, 2)).toBe(2); // 2.5 → 2 (чётное)
    expect(bankersRoundDiv(7, 2)).toBe(4); // 3.5 → 4 (чётное)
    expect(bankersRoundDiv(25, 10)).toBe(2); // 2.5 → 2
    expect(bankersRoundDiv(35, 10)).toBe(4); // 3.5 → 4
  });
});

describe("computeCommission", () => {
  // База = гонорар Татьяны (CONSULTANT_FEE): пример ТЗ §2 (20/15/5, фикс 20000)
  const cfg = {
    clientRateBp: 2000, // 20.00%
    realtorRateBp: 1500, // 15.00%
    platformRateBp: 500, // 5.00%
    base: "CONSULTANT_FEE" as const,
    executor: { type: "FIXED" as const, fixedKopecks: 2_000_000 }, // 20 000 ₽
  };

  it("возврат 1 000 000 ₽, база = гонорар", () => {
    const r = computeCommission({ refundKopecks: 100_000_000, ...cfg });
    // клиент платит 20% от 1 000 000 = 200 000 ₽
    expect(r.clientFeeKopecks).toBe(20_000_000);
    expect(r.baseKopecks).toBe(20_000_000); // база = гонорар
    // риэлтор 15% от гонорара 200 000 = 30 000 ₽
    expect(r.realtorKopecks).toBe(3_000_000);
    // площадка 5% от 200 000 = 10 000 ₽
    expect(r.platformKopecks).toBe(1_000_000);
    // исполнитель фикс 20 000 ₽
    expect(r.executorKopecks).toBe(2_000_000);
    // Татьяне: 200 000 − 30 000 − 10 000 − 20 000 = 140 000 ₽
    expect(r.consultantNetKopecks).toBe(14_000_000);
  });

  it("инвариант: доли + остаток == гонорар клиента", () => {
    const r = computeCommission({ refundKopecks: 73_456_789, ...cfg });
    expect(
      r.realtorKopecks + r.platformKopecks + r.executorKopecks + r.consultantNetKopecks,
    ).toBe(r.clientFeeKopecks);
  });

  it("база = весь возврат (REFUND_AMOUNT): доли считаются от возврата", () => {
    const r = computeCommission({
      refundKopecks: 100_000_000,
      clientRateBp: 2000,
      realtorRateBp: 1500,
      platformRateBp: 500,
      base: "REFUND_AMOUNT",
      executor: { type: "FIXED", fixedKopecks: 0 },
    });
    expect(r.baseKopecks).toBe(100_000_000); // весь возврат
    // риэлтор 15% + площадка 5% от 1 000 000 = 150 000 + 50 000 = 200 000 = весь гонорар
    expect(r.realtorKopecks).toBe(15_000_000);
    expect(r.platformKopecks).toBe(5_000_000);
    // Татьяне 0 (весь гонорар ушёл), исполнителю 0
    expect(r.consultantNetKopecks).toBe(0);
  });

  it("исполнитель по проценту (PERCENT)", () => {
    const r = computeCommission({
      refundKopecks: 100_000_000,
      clientRateBp: 2000,
      realtorRateBp: 1500,
      platformRateBp: 500,
      base: "CONSULTANT_FEE",
      executor: { type: "PERCENT", rateBp: 1000 }, // 10% от гонорара 200 000 = 20 000
    });
    expect(r.executorKopecks).toBe(2_000_000);
    expect(r.consultantNetKopecks).toBe(14_000_000);
  });

  it("кривой конфиг (доли > гонорара) → отрицательный остаток, не бросаем", () => {
    const r = computeCommission({
      refundKopecks: 100_000_000,
      clientRateBp: 2000,
      realtorRateBp: 9900, // 99% + площадка 5% = 104% гонорара — перебор
      platformRateBp: 500,
      base: "CONSULTANT_FEE",
      executor: { type: "FIXED", fixedKopecks: 0 },
    });
    expect(r.consultantNetKopecks).toBeLessThan(0);
  });

  it("нулевой возврат → все нули (кроме, возможно, фикса исполнителя)", () => {
    const r = computeCommission({ refundKopecks: 0, ...cfg });
    expect(r.clientFeeKopecks).toBe(0);
    expect(r.realtorKopecks).toBe(0);
    expect(r.platformKopecks).toBe(0);
    expect(r.executorKopecks).toBe(2_000_000); // фикс не зависит от возврата
  });
});
