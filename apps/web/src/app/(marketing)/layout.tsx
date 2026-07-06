import Link from "next/link";
import type { ReactNode } from "react";

/** Публичная обвязка: шапка с входом/CTA + подвал. Дизайн — M5 */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/" className="text-lg font-bold tracking-tight">
            Возврат налогов
          </Link>
          <nav className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Войти
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              Стать партнёром
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-4 text-xs text-slate-500">
          Закрытый пилот. Доступ — по приглашениям.
        </div>
      </footer>
    </div>
  );
}
