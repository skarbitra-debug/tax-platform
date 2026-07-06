"use client";

import { useActionState } from "react";
import { registerRealtor, type AuthFormState } from "@/actions/auth.actions";

const initialState: AuthFormState = {};

/** Ошибка конкретного поля из Zod flatten() */
function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return <p className="mt-1 text-xs text-red-600">{errors[0]}</p>;
}

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none";

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(registerRealtor, initialState);
  const fe = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="mt-4 space-y-4">
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Имя</span>
        <input type="text" name="name" required autoComplete="name" className={inputCls} placeholder="Анна" />
        <FieldError errors={fe.name} />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium">Телефон</span>
        <input
          type="tel"
          name="phone"
          required
          autoComplete="tel"
          inputMode="tel"
          className={inputCls}
          placeholder="+7 900 000-00-00"
        />
        <FieldError errors={fe.phone} />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium">Email</span>
        <input type="email" name="email" required autoComplete="email" inputMode="email" className={inputCls} placeholder="you@example.com" />
        <FieldError errors={fe.email} />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium">Пароль</span>
        <input type="password" name="password" required minLength={10} autoComplete="new-password" className={inputCls} />
        <p className="mt-1 text-xs text-slate-500">Минимум 10 символов.</p>
        <FieldError errors={fe.password} />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium">Инвайт-код</span>
        <input type="text" name="inviteCode" required autoComplete="off" className={inputCls} placeholder="Код от вашего агентства" />
        <FieldError errors={fe.inviteCode} />
      </label>

      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {pending ? "Создаём аккаунт…" : "Зарегистрироваться"}
      </button>
    </form>
  );
}
