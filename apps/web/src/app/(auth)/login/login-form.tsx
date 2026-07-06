"use client";

import { useActionState } from "react";
import { loginWithRedirect, type AuthFormState } from "@/actions/auth.actions";

const initialState: AuthFormState = {};

/** Клиентская форма: useActionState показывает ошибку и pending-состояние */
export function LoginForm({ callbackUrl }: { callbackUrl?: string }) {
  const [state, formAction, pending] = useActionState(loginWithRedirect, initialState);

  return (
    <form action={formAction} className="mt-4 space-y-4">
      {/* callbackUrl из middleware — вернём пользователя туда, куда он шёл */}
      <input type="hidden" name="callbackUrl" value={callbackUrl ?? ""} />

      <label className="block">
        <span className="mb-1 block text-sm font-medium">Email</span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          inputMode="email"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          placeholder="you@example.com"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium">Пароль</span>
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
      </label>

      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {pending ? "Входим…" : "Войти"}
      </button>
    </form>
  );
}
