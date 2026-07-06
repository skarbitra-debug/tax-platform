"use client";

import { useActionState } from "react";
import {
  type SettingsState,
  addStatusAction,
  toggleStatusAction,
  updateStatusAction,
} from "@/actions/settings.actions";

const inputCls =
  "rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none";
const btnCls =
  "rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50";

export type StatusItem = {
  id: string;
  code: string;
  label: string;
  color: string | null;
  sortOrder: number;
  isActive: boolean;
  isInitial: boolean;
  isTerminal: boolean;
};

/** Одна строка статуса: правка label/color/order + вкл/выкл */
export function StatusRow({ status }: { status: StatusItem }) {
  const [state, action, pending] = useActionState(updateStatusAction, {} as SettingsState);
  const [, toggleAction] = useActionState(toggleStatusAction, {} as SettingsState);

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 py-3 last:border-0">
      <form action={action} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="statusId" value={status.id} />
        <span className="w-36 font-mono text-xs text-slate-400">{status.code}</span>
        <input name="label" defaultValue={status.label} className={`${inputCls} w-44`} />
        <input
          name="color"
          defaultValue={status.color ?? ""}
          placeholder="#16a34a"
          className={`${inputCls} w-24`}
        />
        <input
          name="sortOrder"
          type="number"
          defaultValue={status.sortOrder}
          className={`${inputCls} w-20`}
        />
        <button type="submit" disabled={pending} className={btnCls}>
          Сохранить
        </button>
        {state.error && <span className="text-xs text-red-600">{state.error}</span>}
        {state.ok && <span className="text-xs text-emerald-600">✓</span>}
      </form>

      <div className="flex items-center gap-2">
        {status.isInitial && <span className="text-xs text-slate-400">начальный</span>}
        {status.isTerminal && <span className="text-xs text-slate-400">финальный</span>}
        <form action={toggleAction}>
          <input type="hidden" name="statusId" value={status.id} />
          <button
            type="submit"
            className={`text-xs ${status.isActive ? "text-red-600" : "text-emerald-600"} hover:underline`}
          >
            {status.isActive ? "выключить" : "включить"}
          </button>
        </form>
      </div>
    </div>
  );
}

/** Добавить свой статус */
export function AddStatusForm() {
  const [state, action, pending] = useActionState(addStatusAction, {} as SettingsState);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input name="code" placeholder="КОД_СТАТУСА" className={`${inputCls} w-44`} />
      <input name="label" placeholder="Название" className={`${inputCls} w-44`} />
      <input name="color" placeholder="#16a34a" className={`${inputCls} w-24`} />
      <input name="sortOrder" type="number" placeholder="порядок" defaultValue={90} className={`${inputCls} w-24`} />
      <button type="submit" disabled={pending} className={btnCls}>
        Добавить статус
      </button>
      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
      {state.ok && <span className="text-xs text-emerald-600">Добавлен ✓</span>}
    </form>
  );
}
