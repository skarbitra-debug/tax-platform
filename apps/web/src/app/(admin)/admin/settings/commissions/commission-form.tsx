"use client";

import { useActionState } from "react";
import { type SettingsState, saveCommissionConfigAction } from "@/actions/settings.actions";

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none";
const label = "mb-1 block text-xs font-medium text-slate-500";

export type ConfigDefaults = {
  clientRatePct: string;
  realtorRatePct: string;
  platformRatePct: string;
  commissionBase: string;
  executorPayoutType: string;
  executorFixedAmount: string;
  executorRatePct: string;
  minTaxThreshold: string;
  showPlatformShareToRealtor: boolean;
};

/**
 * Форма ставок комиссий (§2). Сохранение создаёт НОВУЮ версию конфига и
 * деактивирует прежнюю — старые сделки не пересчитываются задним числом.
 */
export function CommissionForm({ defaults }: { defaults: ConfigDefaults }) {
  const [state, action, pending] = useActionState(saveCommissionConfigAction, {} as SettingsState);
  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className={label}>Клиент платит, %</label>
          <input name="clientRatePct" defaultValue={defaults.clientRatePct} className={inputCls} />
        </div>
        <div>
          <label className={label}>Риэлтор, %</label>
          <input name="realtorRatePct" defaultValue={defaults.realtorRatePct} className={inputCls} />
        </div>
        <div>
          <label className={label}>Площадка / агентство, %</label>
          <input name="platformRatePct" defaultValue={defaults.platformRatePct} className={inputCls} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label}>База расчёта долей</label>
          <select name="commissionBase" defaultValue={defaults.commissionBase} className={inputCls}>
            <option value="CONSULTANT_FEE">От гонорара Татьяны</option>
            <option value="REFUND_AMOUNT">От всей суммы возврата</option>
          </select>
        </div>
        <div>
          <label className={label}>Порог налога (заявки ниже помечаются), ₽</label>
          <input name="minTaxThreshold" defaultValue={defaults.minTaxThreshold} className={inputCls} placeholder="250000" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className={label}>Исполнитель</label>
          <select name="executorPayoutType" defaultValue={defaults.executorPayoutType} className={inputCls}>
            <option value="FIXED">Фикс, ₽</option>
            <option value="PERCENT">Процент</option>
          </select>
        </div>
        <div>
          <label className={label}>Фикс исполнителю, ₽</label>
          <input name="executorFixedAmount" defaultValue={defaults.executorFixedAmount} className={inputCls} placeholder="20000" />
        </div>
        <div>
          <label className={label}>Или процент исполнителю, %</label>
          <input name="executorRatePct" defaultValue={defaults.executorRatePct} className={inputCls} />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="showPlatformShareToRealtor"
          defaultChecked={defaults.showPlatformShareToRealtor}
        />
        Показывать долю площадки риэлтору
      </label>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          Сохранить как новую версию
        </button>
        {state.error && <span className="text-sm text-red-600">{state.error}</span>}
        {state.ok && <span className="text-sm text-emerald-600">Сохранено ✓</span>}
      </div>
    </form>
  );
}
