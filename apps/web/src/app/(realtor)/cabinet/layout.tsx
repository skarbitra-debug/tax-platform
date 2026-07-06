import Link from "next/link";
import type { ReactNode } from "react";
import { signOutAction } from "@/actions/auth.actions";
import { requireRole } from "@/lib/require-role";

/**
 * Guard REALTOR: 2-й слой поверх middleware — сверка User.status по БД.
 * BLOCKED с живым JWT сюда не пройдёт (план §1/§3).
 */
export default async function CabinetLayout({ children }: { children: ReactNode }) {
  const session = await requireRole("REALTOR");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href="/cabinet" className="text-lg font-bold tracking-tight">
              Кабинет партнёра
            </Link>
            <nav className="hidden items-center gap-4 text-sm text-slate-600 sm:flex">
              <Link href="/cabinet" className="hover:text-slate-900">
                Главная
              </Link>
              <span className="cursor-default text-slate-400" title="Появится в M1">
                Мои заявки (скоро)
              </span>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-600 sm:inline">
              {session.user.name ?? session.user.email}
            </span>
            <form action={signOutAction}>
              <button
                type="submit"
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
              >
                Выйти
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
