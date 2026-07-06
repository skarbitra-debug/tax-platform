import Link from "next/link";
import type { ReactNode } from "react";
import { signOutAction } from "@/actions/auth.actions";
import { requireRole } from "@/lib/require-role";

/** Guard ADMIN: сверка User.status по БД (2-й слой; см. require-role.ts) */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await requireRole("ADMIN");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-slate-900 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="text-lg font-bold tracking-tight">
              Админ-панель
            </Link>
            <nav className="hidden items-center gap-4 text-sm text-slate-300 sm:flex">
              <span className="cursor-default text-slate-500" title="Появится в M1">
                Сделки (M1)
              </span>
              <span className="cursor-default text-slate-500" title="Появится в M1">
                Риэлторы (M1)
              </span>
              <span className="cursor-default text-slate-500" title="Появится в M1">
                Инвайты (M1)
              </span>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-300 sm:inline">
              {session.user.name ?? session.user.email}
            </span>
            <form action={signOutAction}>
              <button
                type="submit"
                className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
              >
                Выйти
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
