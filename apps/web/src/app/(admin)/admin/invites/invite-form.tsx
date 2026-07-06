"use client";

import { useActionState } from "react";
import { createInvite, type InviteFormState } from "@/actions/invite.actions";

const initialState: InviteFormState = {};

/** Ошибка конкретного поля из Zod flatten() — как в register-form */
function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return <p className="mt-1 text-xs text-red-600">{errors[0]}</p>;
}

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none";

/** Форма создания инвайт-кода; сам код генерирует сервер (invite.actions) */
export function InviteForm() {
  const [state, formAction, pending] = useActionState(createInvite, initialState);
  const fe = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Метка</span>
          <input
            type="text"
            name="label"
            autoComplete="off"
            className={inputCls}
            placeholder="Агентство «Макромир»"
          />
          <p className="mt-1 text-xs text-slate-500">Необязательно: кому выдан код.</p>
          <FieldError errors={fe.label} />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">Лимит использований</span>
          <input
            type="number"
            name="maxUses"
            defaultValue={50}
            min={1}
            max={10000}
            inputMode="numeric"
            className={inputCls}
          />
          <FieldError errors={fe.maxUses} />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">Действует до</span>
          <input type="date" name="expiresAt" className={inputCls} />
          <p className="mt-1 text-xs text-slate-500">Пусто — бессрочный.</p>
          <FieldError errors={fe.expiresAt} />
        </label>
      </div>

      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      {state.createdCode && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Код создан:{" "}
          <span className="font-mono text-base font-semibold tracking-wide">
            {state.createdCode}
          </span>{" "}
          — передайте его агентству.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {pending ? "Создаём…" : "Создать код"}
      </button>
    </form>
  );
}
