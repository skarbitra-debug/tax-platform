import Link from "next/link";
import type { ReactNode } from "react";
import { BRAND } from "@/lib/brand";

/** [M5] Публичная обвязка витрины: шапка с входом/CTA + подвал. */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/" className="text-lg font-bold tracking-tight">
            {BRAND.name}
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
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
              style={{ backgroundColor: "var(--accent)" }}
            >
              Стать партнёром
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>© {BRAND.name}. Закрытый пилот — доступ по приглашениям.</span>
          <span>Возврат налогов ведётся в рамках законодательства РФ.</span>
        </div>
      </footer>
    </div>
  );
}
