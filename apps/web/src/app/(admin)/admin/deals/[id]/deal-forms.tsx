"use client";

import { useActionState } from "react";
import {
  type DealActionState,
  addPayoutAction,
  changeStatusAction,
  markClientPaidAction,
  markContractSentAction,
  setRefundAction,
} from "@/actions/deal-admin.actions";

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none";
const btnCls =
  "rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50";

function Feedback({ state }: { state: DealActionState }) {
  if (state.error) return <p className="text-sm text-red-600">{state.error}</p>;
  if (state.ok) return <p className="text-sm text-emerald-600">Сохранено ✓</p>;
  return null;
}

type StatusOption = { id: string; label: string };

/** Ручная смена статуса (§6): выпадающий список настраиваемых статусов */
export function StatusChangeForm({
  dealId,
  statuses,
  currentStatusId,
}: {
  dealId: string;
  statuses: StatusOption[];
  currentStatusId: string;
}) {
  const [state, action, pending] = useActionState(changeStatusAction, {} as DealActionState);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="dealId" value={dealId} />
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Новый статус</label>
        <select name="toStatusId" defaultValue={currentStatusId} className={inputCls}>
          {statuses.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <input name="comment" placeholder="Комментарий (необязательно)" className={inputCls} />
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={btnCls}>
          Сменить статус
        </button>
        <Feedback state={state} />
      </div>
    </form>
  );
}

/** Проставить фактический возврат — триггерит пересчёт комиссий */
export function RefundForm({ dealId, currentRefund }: { dealId: string; currentRefund: string | null }) {
  const [state, action, pending] = useActionState(setRefundAction, {} as DealActionState);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="dealId" value={dealId} />
      <div className="flex-1">
        <label className="mb-1 block text-xs font-medium text-slate-500">
          Фактический возврат, ₽
        </label>
        <input
          name="refund"
          inputMode="decimal"
          defaultValue={currentRefund ?? ""}
          placeholder="например 1250000"
          className={inputCls}
        />
      </div>
      <button type="submit" disabled={pending} className={btnCls}>
        Сохранить и пересчитать
      </button>
      <Feedback state={state} />
    </form>
  );
}

/** Ручная отметка «клиент оплатил» */
export function ClientPaidForm({ dealId, suggested }: { dealId: string; suggested: string | null }) {
  const [state, action, pending] = useActionState(markClientPaidAction, {} as DealActionState);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="dealId" value={dealId} />
      <div className="flex-1">
        <label className="mb-1 block text-xs font-medium text-slate-500">Сумма оплаты, ₽</label>
        <input
          name="amount"
          inputMode="decimal"
          defaultValue={suggested ?? ""}
          placeholder="сколько поступило"
          className={inputCls}
        />
      </div>
      <button type="submit" disabled={pending} className={btnCls}>
        Отметить оплату
      </button>
      <Feedback state={state} />
    </form>
  );
}

/** Отметка «договор отправлен» (§4.8; механизм подписания — §11.3, TODO) */
export function ContractForm({ dealId, sentAt }: { dealId: string; sentAt: string | null }) {
  const [state, action, pending] = useActionState(markContractSentAction, {} as DealActionState);
  return (
    <div className="space-y-2">
      {sentAt ? (
        <p className="text-sm text-emerald-700">Договор отправлен: {sentAt}</p>
      ) : (
        <p className="text-sm text-slate-500">Договор ещё не отправлен.</p>
      )}
      <form action={action} className="flex items-center gap-3">
        <input type="hidden" name="dealId" value={dealId} />
        <button type="submit" disabled={pending} className={btnCls}>
          {sentAt ? "Отправить повторно" : "Отметить «договор отправлен»"}
        </button>
        <Feedback state={state} />
      </form>
    </div>
  );
}

type RealtorOption = { id: string; name: string };

/** Ручная отметка выплаты получателю */
export function PayoutForm({ dealId, realtors }: { dealId: string; realtors: RealtorOption[] }) {
  const [state, action, pending] = useActionState(addPayoutAction, {} as DealActionState);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="dealId" value={dealId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Получатель</label>
          <select name="recipientType" className={inputCls} defaultValue="REALTOR">
            <option value="REALTOR">Риэлтор</option>
            <option value="PLATFORM_AGENCY">Площадка / агентство</option>
            <option value="EXECUTOR">Исполнитель</option>
            <option value="OTHER">Другое</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">
            Риэлтор (если выплата риэлтору)
          </label>
          <select name="realtorId" className={inputCls} defaultValue="">
            <option value="">—</option>
            {realtors.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <input name="amount" inputMode="decimal" placeholder="Сумма, ₽" className={inputCls} />
        <input name="comment" placeholder="Комментарий (необязательно)" className={inputCls} />
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={btnCls}>
          Добавить выплату
        </button>
        <Feedback state={state} />
      </div>
    </form>
  );
}
