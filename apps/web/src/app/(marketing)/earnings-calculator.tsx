"use client";

import { useState } from "react";

/**
 * [M5] Калькулятор дохода риэлтора (секция «Сколько заработаете» референса).
 *
 * Доля риэлтора ≈ 3% от возвращённого налога: по дефолтному конфигу это
 * 15% (realtorRatePct) от гонорара Татьяны, а гонорар — 20% (clientRatePct)
 * от возврата → 0.15 × 0.20 = 0.03. Ставки НАСТРАИВАЕМЫЕ (§2), поэтому это
 * прикидка; при желании поменять — одна константа ниже.
 */
const REALTOR_SHARE_OF_REFUND = 0.03;

function rub(n: number): string {
  // toLocaleString("ru-RU") разделяет разряды неразрывным пробелом;
  // перед ₽ — тоже NBSP, чтобы знак валюты не отрывался переносом
  return Math.round(n).toLocaleString("ru-RU") + " ₽";
}

export function EarningsCalculator() {
  const [clients, setClients] = useState(5);
  const [avgRefund, setAvgRefund] = useState(300_000);

  const perClient = avgRefund * REALTOR_SHARE_OF_REFUND;
  const perMonth = perClient * clients;
  const perYear = perMonth * 12;

  return (
    <div className="landing-card rounded-3xl p-6 sm:p-10">
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Ввод */}
        <div className="space-y-8">
          <div>
            <div className="flex items-baseline justify-between">
              <label className="text-sm font-medium text-white/70">Клиентов в месяц</label>
              <span className="text-lg font-bold tabular-nums text-white">{clients}</span>
            </div>
            <input
              type="range"
              aria-label="Клиентов в месяц"
              min={1}
              max={20}
              value={clients}
              onChange={(e) => setClients(Number(e.target.value))}
              className="mt-3 w-full accent-[var(--accent)]"
            />
            <div className="mt-1 flex justify-between text-xs text-white/45">
              <span>1</span>
              <span>20</span>
            </div>
          </div>

          <div>
            <div className="flex items-baseline justify-between">
              <label className="text-sm font-medium text-white/70">Средний возврат клиента</label>
              <span className="text-lg font-bold tabular-nums text-white">{rub(avgRefund)}</span>
            </div>
            <input
              type="range"
              aria-label="Средний возврат клиента, рублей"
              min={100_000}
              max={1_000_000}
              step={50_000}
              value={avgRefund}
              onChange={(e) => setAvgRefund(Number(e.target.value))}
              className="mt-3 w-full accent-[var(--accent)]"
            />
            <div className="mt-1 flex justify-between text-xs text-white/45">
              <span>100 тыс</span>
              <span>1 млн</span>
            </div>
          </div>

          <p className="text-xs text-white/55">
            Прикидка: ваша доля ≈ 3% от возвращённого клиенту налога. Точный процент задаётся
            в настройках программы.
          </p>
        </div>

        {/* Результат */}
        <div className="flex flex-col justify-center rounded-2xl border border-white/10 bg-black/20 p-8 text-center">
          <div className="text-sm text-white/50">Ваш доход в месяц</div>
          <div className="mt-2 text-5xl font-bold tabular-nums text-emerald-gradient">{rub(perMonth)}</div>
          <div className="mt-6 grid grid-cols-2 gap-4 border-t border-white/10 pt-6 text-sm">
            <div>
              <div className="font-semibold tabular-nums text-white">{rub(perClient)}</div>
              <div className="text-xs text-white/55">с одного клиента</div>
            </div>
            <div>
              <div className="font-semibold tabular-nums text-white">{rub(perYear)}</div>
              <div className="text-xs text-white/55">в год</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
