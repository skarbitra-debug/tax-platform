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
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-y-2 px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link href="/admin" className="text-lg font-bold tracking-tight">
              Админ-панель
            </Link>
            {/* [M1-7] Разделы живые; nav виден и на мобильном (flex-wrap выше) */}
            <nav className="flex items-center gap-4 text-sm text-slate-300">
              <Link href="/admin/deals" className="hover:text-white">
                Заявки
              </Link>
              <Link href="/admin/realtors" className="hover:text-white">
                Риэлторы
              </Link>
              <Link href="/admin/invites" className="hover:text-white">
                Инвайты
              </Link>
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
